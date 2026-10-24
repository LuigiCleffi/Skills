---
name: ddia-encoding-and-evolution
description: "How to encode data for storage and transport so that old and new code can coexist: backward and forward compatibility, rolling upgrades, language-specific serialization and its security risks, JSON/XML/CSV pitfalls (large numbers, binary data, schemas), binary JSON (MessagePack), Thrift and Protocol Buffers field tags, Avro writer's and reader's schemas, schema evolution rules, schema registries, preserving unknown fields, data outliving code, REST vs SOAP vs RPC, API versioning, message brokers and distributed actors, based on Chapter 4 (Encoding and Evolution) of Designing Data-Intensive Applications. Use when adding, renaming, removing or retyping a field in a message, event, API payload, protobuf/Avro/Thrift schema or stored document, planning a rolling deploy or schema migration, choosing JSON vs Protobuf vs Avro, designing a REST or gRPC API or its versioning, old consumers crash on new messages, fields silently disappear after an update, 64-bit IDs get corrupted in JavaScript, or the user mentions serialization, Java Serializable, pickle, field tag, reserved, required/optional, default value, union type, schema registry, compatibility mode, OpenAPI, Kafka message format or breaking change."
---

# Encoding and Evolution

Assume that old and new versions of code and data run side by side, because rolling deploys, unupdated clients and years-old stored records make that true. Every change to an encoded format must keep backward compatibility (new code reads old data) and forward compatibility (old code reads new data), or it must be shipped as an explicitly versioned break.

## Why compatibility is not optional

- Server deploys roll node by node; mobile and desktop clients update whenever users let them; a database holds values written by every past version. Old and new readers and writers overlap.
- Backward compatibility is usually easy: the new code author knows the old format.
- Forward compatibility is the hard part: old code must tolerate (ignore and preserve) what newer code adds.
- "Encoding" here means turning in-memory structures into bytes (serialization, marshalling); it is unrelated to encryption, and unrelated to serializable transaction isolation.

## Choosing an encoding

| Format | Use for | Watch out for |
|---|---|---|
| Language built-ins (Java `Serializable`, Python `pickle`, Ruby `Marshal`) | Only transient, same-process-family use | Locks you to one language; decoding arbitrary bytes can instantiate arbitrary classes (remote code execution); no versioning; often slow and bulky |
| JSON / XML / CSV | Public APIs, cross-organization exchange, debugging | Number ambiguity, no binary type, optional schemas, CSV escaping |
| Binary JSON (MessagePack, BSON) | Niche size/speed gains | Field names still in every record; saves little |
| Protocol Buffers / Thrift | Internal services, RPC, statically typed code | Requires schema and code generation; tags must be managed |
| Avro | Large files, data pipelines, dumps from databases, dynamically generated schemas | Reader needs the writer's schema; registry or file header required |

- Never decode untrusted input with a language-native deserializer.
- Pick text formats when humans and other organizations must read them; pick schema-based binary formats when volume, latency, or a precise contract matters.

### Textual format pitfalls

- JSON does not distinguish integers from floats and has no precision rule. Integers above 2^53 lose precision in JavaScript and other double-based parsers. Send 64-bit IDs as strings.

```json
{ "id": 1460320528712105984, "id_str": "1460320528712105984" }
```

- No binary strings in JSON or XML: Base64 works but grows size by about a third; document that the field is Base64.
- Schemas are optional (JSON Schema, XML Schema). Without one, the encoding of numbers, dates and binary must be agreed and enforced in code.
- CSV has no schema and inconsistent escaping across parsers; use a real CSV library and never split on commas by hand.

## Protocol Buffers and Thrift: field tags

```proto
syntax = "proto3";
message Order {
  string order_id = 1;
  optional int64 discount_cents = 2;
  repeated string sku = 3;
  reserved 4;              // was coupon_code; never reuse the number
  reserved "coupon_code";
}
```

- Encoded data carries tag numbers and wire types, never field names. You may rename a field freely; you may never change its tag.
- Adding a field: give it a new tag. Old readers skip unknown tags (wire type tells them how many bytes), so forward compatibility holds. New fields must be optional or have a default, or new code fails on old data.
- Removing a field: only if it was optional; reserve its tag (and name) so it is never reused.
- Changing types: check the format's documentation. Widening int32 to int64 is safe for new readers, but old readers truncate large values.
- Protobuf `repeated` allows evolving a single optional field into a list (old readers see the last element). Thrift lists do not allow that, but support nested lists.
- `required` only adds a runtime check; it is not encoded.

Current note: proto3 removed `required` entirely (every field is optional with a zero default), and since protobuf 3.15 `optional` is back in proto3 to track field presence. gRPC runs on HTTP/2 and supports streaming in both directions; tools such as `buf breaking` can check Protobuf schema changes for compatibility in CI.

## Avro: writer's and reader's schemas

```json
{
  "type": "record", "name": "Order",
  "fields": [
    {"name": "orderId", "type": "string"},
    {"name": "discountCents", "type": ["null", "long"], "default": null},
    {"name": "sku", "type": {"type": "array", "items": "string"}}
  ]
}
```

- Encoded bytes contain only values in schema order; no tags, no types. Decoding requires the exact writer's schema.
- At read time Avro resolves writer's schema against reader's schema by field name: fields only in the writer are ignored; fields only in the reader get the reader's default.
- Rules: add or remove only fields that have a default. Adding without a default breaks backward compatibility; removing without a default breaks forward compatibility.
- Null must be explicit through a union (`["null", "long"]`), and the default must match the union's first branch.
- Renaming uses aliases in the reader's schema: backward compatible only. Adding a union branch: backward compatible only.
- How the reader gets the writer's schema:
  - Large file: schema once in the object container file header.
  - Database records: version number (or schema hash) prefix per record plus a schema table.
  - Network connection: negotiate at connection setup.
  - Message streams: schema ID per message resolved through a schema registry.
- Avro has no tags to assign, so it suits schemas generated from database tables: regenerate on every export, and readers match fields by name.
- Code generation is optional; dynamic languages can read container files directly.

Current note: a schema registry (for example Confluent Schema Registry, also used with Protobuf and JSON Schema) enforces compatibility modes such as BACKWARD, FORWARD, FULL and their transitive variants at publish time; set the mode per subject deliberately rather than relying on the default.

## Why schemas pay off

- More compact than self-describing formats (no field names in data).
- The schema is documentation that cannot drift, because decoding depends on it.
- Keeping all schema versions lets you check compatibility before deploying.
- Generated types give compile-time checks in statically typed languages.

## Data flow through databases

- A write is a message to future readers, including your own future code: backward compatibility is mandatory, and with rolling deploys forward compatibility is needed too.
- Preserve unknown fields. Old code that decodes into a model class and re-encodes the whole object silently drops fields written by newer code.

```ts
// Lossy: rebuilds the record from known fields only.
await db.put(id, { orderId: o.orderId, discountCents: 500 });

// Safe: keep everything you read, change only what you own.
const raw = await db.get(id);
await db.put(id, { ...raw, discountCents: 500 });
```

- Data outlives code: rows written years ago still have the old shape. Prefer changes the database applies lazily (new nullable column, field with default) over rewriting every row.
- Rewriting (backfilling) a large table is expensive and risky. For renames and type changes use expand-contract: add the new field, write both, backfill in batches, switch reads, then remove the old field in a later release.
- Snapshots and archives are written once: encode them consistently in the latest schema; Avro container files or Parquet are good fits.

## Data flow through services: REST and RPC

- Microservices exist so teams can deploy independently, which means old and new clients and servers coexist; the API encoding must stay compatible across versions.
- REST: a style built on HTTP features (URLs for resources, caching, content negotiation); easy to debug with curl, huge tooling ecosystem. Dominant for public APIs. SOAP: XML protocol with WS-* standards and WSDL; heavy tooling, mostly legacy enterprise.
- A remote call is not a local call. Design for it:
  - It can fail from causes you do not control; plan retries with backoff.
  - It can time out with unknown outcome; the request may have run.
  - Retries can duplicate work; make operations idempotent (idempotency keys, deduplication).
  - Latency varies widely; set timeouts and budgets.
  - Parameters must be encoded; large object graphs are costly.
  - Types differ between languages (for example 64-bit integers in JavaScript).
- Modern RPC frameworks (gRPC, Thrift, Finagle) make the network explicit with futures, streams and service discovery. Use binary RPC for internal service-to-service traffic, REST/JSON for public or cross-organization APIs.
- Compatibility assumption: servers are upgraded before clients, so requests need backward compatibility and responses need forward compatibility. Adding optional request parameters and new response fields is usually safe; clients must ignore unknown response fields.
- When you do not control clients (public APIs), compatibility may have to last indefinitely; a breaking change means running versions side by side. Version in the URL (`/v2/`), in the `Accept` header, or as a per-API-key setting stored on the server; pick one and document it.

Current note: Swagger is now the OpenAPI Specification; GraphQL is another common public API style, where adding fields is safe and removal is handled by deprecation.

## Message-passing data flow

- A broker (queue or topic) buffers when consumers are down, redelivers after crashes, hides consumer addresses, fans out to many consumers and decouples sender from receiver. Communication is one-way; replies go on a separate channel.
- Brokers do not enforce a data model; messages are bytes. Use a compatible schema-based encoding so producers and consumers can deploy in any order.
- A consumer that republishes to another topic must preserve fields it does not understand.
- Distributed actors (Akka, Orleans, Erlang) still need compatible message encoding for rolling upgrades; avoid language-native serializers there.

Current note: Akka disables Java serialization by default since 2.6 and recommends Jackson or Protobuf serializers; Erlang maps have been standard since OTP 18.

## Workflow
1. Identify every reader and writer of the data: services, consumers, clients, stored rows, archives, warehouses. Note who deploys first and who you do not control.
2. Classify the change: add field, remove field, rename, retype, change semantics. Semantic changes to an existing field are breaking even if the bytes still parse.
3. Check it against the format's rules: new tag or name with default, never reuse tags, reserve removed ones, widen types with care.
4. Run an automated compatibility check (schema registry, `buf breaking`, OpenAPI diff, contract tests) in CI before merging.
5. Verify unknown fields survive read-modify-write in every service that rewrites records or republishes messages; add a test that round-trips a record containing an extra field.
6. Order the rollout: readers that tolerate the new format first, writers second; for renames and type changes use expand-contract across several releases.
7. For migrations and backfills on production data, confirm the environment, get approval, run in batches with progress tracking, and keep a revert plan (old field still written, old readers still working) until the change is complete.

## Red flags
- Java `Serializable`, `pickle` or similar on data from the network or stored long-term.
- Reusing or changing a Protobuf/Thrift tag; deleting a field without `reserved`.
- Adding a required field, or an Avro field without a default, to a schema already in use.
- 64-bit IDs sent as JSON numbers to JavaScript clients.
- Model classes that drop unknown fields when re-saving a record or forwarding a message.
- Code that assumes all stored records have the current shape.
- One-shot full-table rewrite on production with no batching or rollback path.
- RPC client code with no timeout, no retry policy, or retries on non-idempotent operations.
- A breaking API change shipped without a new version or a deprecation period.
- Producers and consumers deployed in lockstep because the message format is not compatible.

## Related
- `../ReliableScalableMaintainable/reliableScalableMaintainable.md` — evolvability as a maintainability goal.
- `../DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — schema-on-read vs schema-on-write.
- `../StorageAndRetrieval/storageAndRetrieval.md` — on-disk layouts and columnar formats such as Parquet.
- `../../DistributedData/Replication/replication.md` — replication logs and mixed-version replicas during upgrades.
- `../../DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` — timeouts and unknown outcomes behind RPC failures.
- `../../DerivedData/BatchProcessing/batchProcessing.md` — Avro and Parquet files in data pipelines.
- `../../DerivedData/StreamProcessing/streamProcessing.md` — message brokers, logs and event schemas.
- `../../../CleanCode/Boundaries/boundaries.md` — isolating third-party formats and APIs behind your own interfaces (when installed).
- `../../../CleanCode/ErrorHandling/errorHandling.md` — handling remote-call failures explicitly (when installed).
- `../../../DBA/Oracle/PlSql/OnlineApplicationUpgrades/onlineApplicationUpgrades.md` — online schema changes in Oracle (when installed).
- `../../../TDD/Patterns/RedBarPatterns/redBarPatterns.md` — learning tests for serialization libraries (when installed).
