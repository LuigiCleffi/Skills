---
name: azure-ai-search
description: "How to provision and use Azure AI Search, formerly Azure Search (search as a service, pricing tiers, replicas and partitions, index schema with key, searchable, filterable, sortable, facetable and retrievable fields, push indexing through the REST docs/index endpoint with upload, merge, mergeOrUpload and delete actions, pull indexing with indexers and data sources, full-text queries with search, searchFields, highlight, $select, $filter, $orderby, $top, $skip, $count and facet, OData filter syntax, admin vs query API keys, Entra ID RBAC, api-version pinning and schema changes that require a rebuild), based on Chapter 8 (Azure Search: search-engine intelligence in your application) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user adds site or product search, faceted navigation, highlighting, geo or autocomplete search, runs az search service create, defines or changes an index, posts to /indexes/{name}/docs/index, sees 400 Invalid expression, CannotChangeExistingField, 403 Forbidden, 207 Multi-Status partial failures, 503 throttling, empty results for a field, or asks how to keep the index in sync with SQL, Cosmos DB or Blob storage."
---

# Azure AI Search

Use a managed search service when users need relevance-ranked full-text search, facets and highlighting over data that lives elsewhere; keep the source of truth in your database and treat the index as a rebuildable projection. Decide field attributes up front, because most changes to an existing field mean rebuilding the index. Creating services, changing tiers, rotating keys and deleting indexes affect users, so confirm subscription, resource group and environment and get approval first.

Current note: Azure Search was renamed Azure Cognitive Search and then Azure AI Search. The book's `2015-02-28-preview` API, classic portal steps and free-tier document counts are obsolete; the service now also offers vector, hybrid and semantic ranking. Pin a current GA `api-version` (for example `2024-07-01`) and check the docs before relying on newer features.

## Provisioning and capacity

```bash
az account show --query "{sub:name, id:id}"
az search service create -g rg-search-prod -n srch-shop-prod -l brazilsouth \
  --sku standard --replica-count 2 --partition-count 1
```

- Free tier: shared, small, no SLA; only for experiments. Basic and Standard tiers get dedicated capacity; Storage Optimized tiers suit very large, low-QPS indexes.
- Replicas add query throughput and availability; partitions add storage and indexing throughput. Billing is per search unit (replicas x partitions).
- The SLA needs at least 2 replicas for queries and 3 for queries plus indexing.
- Check whether your service supports changing tier in place; if not, a tier change means a new service and a full re-index, so size it before go-live.
- Pick the region closest to the app and data; data egress and latency matter.

## Designing the index

```json
{
  "name": "products-v1",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true, "filterable": true },
    { "name": "name", "type": "Edm.String", "searchable": true, "analyzer": "pt-BR.microsoft" },
    { "name": "description", "type": "Edm.String", "searchable": true, "analyzer": "pt-BR.microsoft" },
    { "name": "brand", "type": "Edm.String", "filterable": true, "facetable": true },
    { "name": "tags", "type": "Collection(Edm.String)", "searchable": true, "facetable": true },
    { "name": "price", "type": "Edm.Double", "filterable": true, "sortable": true, "facetable": true },
    { "name": "location", "type": "Edm.GeographyPoint", "filterable": true, "sortable": true }
  ]
}
```

- Exactly one `key` field, a string. Use the source primary key.
- `searchable` for full-text; `filterable` for `$filter` and facet drill-down; `sortable` for `$orderby`; `facetable` for counts; `retrievable` (default true) to return it. Each attribute costs storage, so do not enable everything.
- Use arrays (`Collection(Edm.String)`) for tags instead of comma-joined strings; comma strings cannot be faceted per value.
- Choose a language analyzer per field (`pt-BR.microsoft`, `en.lucene`); the default standard analyzer does not stem.
- Add a suggester for autocomplete and suggestions; existing fields cannot be added to a suggester later, so plan it with the schema.
- You can add fields to an existing index, but changing type, analyzer or most attributes of an existing field fails (`CannotChangeExistingField`). Version index names (`products-v2`), build the new one, switch the application, then delete the old one.
- Keep index definitions in source control and apply them from the pipeline, not by clicking in the portal.

## Indexing

Push model (your code sends documents):

```bash
curl -sS -X POST \
  "https://srch-shop-prod.search.windows.net/indexes/products-v1/docs/index?api-version=2024-07-01" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{ "value": [ { "@search.action": "mergeOrUpload", "id": "42", "name": "Notebook 13", "brand": "Acme", "price": 3900.0 } ] }'
```

- Actions: `upload` (replace), `merge` (fails if missing), `mergeOrUpload` (idempotent, usually the right default), `delete`.
- Batches: up to 1,000 documents or about 16 MB. The response can be `207` with per-document failures; check every `status` and retry failed keys with backoff.
- Pull model: an indexer with a data source (Azure SQL, Cosmos DB, Blob, Table storage) on a schedule with change and deletion detection. Prefer it when the source is supported; it handles change tracking for you.
- Deletes in the source must reach the index (soft-delete column or deletion detection policy), otherwise stale documents keep showing.
- Index only what users may see. Search has no row-level security; for per-user visibility, store an ACL field (group IDs) and always apply a security filter on the server.

## Querying

```
GET /indexes/products-v1/docs?api-version=2024-07-01
    &search=notebook ssd&searchFields=name,description&searchMode=all
    &$select=id,name,price&$filter=brand eq 'Acme' and price le 4000
    &$orderby=price desc&$top=20&$skip=0&$count=true
    &facet=brand,count:10&facet=price,interval:500&highlight=description
```

- `search=*` returns everything (ranked equally); combine with `$filter` and `$orderby`.
- `queryType=full` enables Lucene syntax (fields, fuzzy `~`, proximity, regex); `simple` is safer for raw user input.
- Facets return counts; when the user clicks one, add the matching `$filter` and keep the facet so counts update.
- Escape user values in OData filters (single quotes are doubled) or use `search.in(brand, 'A,B', ',')`; never paste raw input into `$filter`.
- Deep paging with `$skip` is limited; for large exports, page by a sortable key with a range filter.
- Geo: `geo.distance(location, geography'POINT(-46.63 -23.55)') le 10` and `$orderby=geo.distance(...)`.

## Access and keys

- Admin keys can create, change and delete everything; query keys can only search. Never ship an admin key to a browser or mobile app, and never paste either into chat, logs or commits.
- Prefer Entra ID: enable role-based access, assign `Search Index Data Reader` to query clients and `Search Index Data Contributor`/`Search Service Contributor` to indexing jobs, then disable key auth where possible.
- Call search from your backend so you can enforce security filters and rate limits; expose a query key to clients only for public catalogs.
- Rotate keys by regenerating the secondary, moving clients, then regenerating the primary. Store keys in Key Vault.
- Restrict network access (IP rules or private endpoint) for internal indexes.

## Workflow

1. Confirm search is the right tool (full-text, relevance, facets); keep the database as source of truth.
2. Confirm subscription, region, environment and tier; estimate documents, size and QPS; get approval for cost.
3. Write the index JSON (key, attributes, analyzers, suggester) in the repo; review it against the queries and facets the UI needs.
4. Provision with Bicep/Terraform/CLI; show the plan or `what-if` before applying in production.
5. Choose push or indexer; implement idempotent `mergeOrUpload`, delete propagation and per-document error handling.
6. Grant RBAC roles or store keys in Key Vault; never expose admin keys.
7. Test queries, filters, facets, highlighting and paging with real data; check relevance with sample searches.
8. For schema changes, build a new versioned index, switch traffic, keep the old one as rollback until verified, then delete it with approval.
9. Monitor query latency, throttling and indexer failures in Azure Monitor.

## Red flags

- Admin key in front-end code, Fiddler/Postman exports, or chat.
- A preview `api-version` in production, or no `api-version` pinning at all.
- Comma-separated tags in one string field; every field marked searchable, filterable and facetable.
- Editing an index in the portal with no definition in source control.
- Ignoring `207` partial failures; no delete propagation from the source.
- User input concatenated into `$filter` or Lucene queries.
- Free tier or a single replica serving production traffic.
- Expecting search to enforce authorization without a security filter.

## Related

- `../SqlDatabase/sqlDatabase.md` and `../DocumentDb/documentDb.md` — typical sources for an indexer.
- `../TableStorage/tableStorage.md` — Table storage as an indexer data source.
- `../AppService/appService.md` — hosting the backend that calls search, with managed identity.
- `../SetupAndSubscription/setupAndSubscription.md` — subscriptions and resource groups.
- `../../Practices/InfrastructureAsCode/infrastructureAsCode.md` — keeping the service and index definitions in code.
- `../../AWS/Fundamentals/FundamentalServices/fundamentalServices.md` — AWS side (OpenSearch Service is the analogous managed search); APIs are not interchangeable.
- `../../../DataSystems/Foundations/StorageAndRetrieval/storageAndRetrieval.md` — inverted indexes and full-text search internals (when installed).
- `../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` — keeping a search index in sync from a change stream (when installed).
- `../../../DBA/PostgreSQL/DataTypes/dataTypes.md` — PostgreSQL full-text search types when a separate service is overkill (when installed).
