---
name: azure-redis-cache
description: "How to provision, secure and use managed Redis on Azure (Azure Cache for Redis tiers and its successor Azure Managed Redis) for output caching, object caching with the cache-aside pattern, distributed session state and other Redis data structures (lists, sets, sorted sets, pub/sub, transactions), including TTLs and key versioning, eviction policy, connection reuse with a single ConnectionMultiplexer, TLS-only access, Microsoft Entra ID authentication instead of access keys, private endpoints, persistence and geo-replication, monitoring, and failure handling when the cache is down, based on Chapter 6 (Cache as a Service with Azure Redis Cache) of Azure: Coloque suas plataformas e serviços no cloud. Use when pages or APIs are slow because of repeated database queries or expensive computation, the user adds OutputCache, IDistributedCache, AddStackExchangeRedisCache or StackExchange.Redis, runs az redis create or az redis list-keys, sees RedisConnectionException, timeouts, \"No connection is available\", high server load, evicted keys or stale data, needs sessions shared across App Service instances, or asks about cache tiers, accessKey in web.config, ports 6379/6380, maxmemory-policy or cache invalidation."
---

# Azure Redis Cache

Use a managed Redis cache to keep hot, recomputable data in memory near the app, so repeated reads skip the database or expensive computation. The cache is never the source of truth: every entry needs a TTL and a way to rebuild it, the app must keep working (slower) when the cache is unavailable, and access goes over TLS with identity-based authentication rather than keys pasted into config.

## Service and tier choice

| Need | Option |
|---|---|
| Dev/test, no SLA | Basic (single node) |
| Production cache with replica and SLA | Standard |
| VNet/private endpoint, persistence, clustering, zone redundancy, geo-replication | Premium |
| Redis modules (search, JSON, time series), active geo-replication, large memory | Enterprise tiers or Azure Managed Redis |

- Put the cache in the same region as the app; cross-region calls erase the latency gain and add egress cost.
- Size by working set plus headroom (fragmentation, replication buffers); watch used memory and server load after launch.
- Scaling between some tiers or sizes is a disruptive change on a production cache; plan it with approval and expect a cold cache afterwards.

Current note: the book's "Azure Redis Cache" is now Azure Cache for Redis, and Microsoft has introduced Azure Managed Redis as its successor and announced retirement dates for the Azure Cache for Redis tiers. Check the current retirement timeline before creating a new cache and prefer Azure Managed Redis for new deployments where available. The tier names and features above may change; verify in the docs.

## Provision securely

```bash
az account show -o table
az redis create -g rg-shop-prod -n redis-shop-prod-001 -l brazilsouth \
  --sku Standard --vm-size c1 --minimum-tls-version 1.2
# Non-TLS port 6379 stays disabled by default; clients use TLS on 6380.
```

- Prefer Microsoft Entra ID authentication with the app's managed identity and disable access-key authentication where supported; then there is no key to leak or rotate.
- If keys are unavoidable: store the connection string in Key Vault and reference it from app settings; rotate with the secondary key (switch apps to secondary, regenerate primary, switch back). `az redis list-keys` prints live secrets — never run it into logs, tickets or chat.
- Restrict network access: private endpoint (and `publicNetworkAccess` disabled) or firewall rules; never open a cache to `0.0.0.0/0`.
- Show what-if or the exact CLI change and get approval before creating, scaling, rebooting, flushing or deleting a production cache. `FLUSHALL` or a reboot turns every request into a database hit at once.

Current note: the book hard-codes the host and access key in `web.config` and in controller code. Treat any access key that appeared in source, screenshots or a book as compromised and regenerate it.

## Output (page) caching

- Cache whole responses only when the content is the same for every user who hits that variation (vary by route, query and headers deliberately). Never output-cache personalized or authenticated pages without varying by user, or users will see each other's data.
- Classic ASP.NET used `RedisOutputCacheProvider` with `[OutputCache(Duration = ...)]`. In ASP.NET Core use output caching with a Redis store (`AddStackExchangeRedisOutputCache`, .NET 8+) or response caching at a CDN/Front Door for public content.

## Object caching: cache-aside

```csharp
// Program.cs — connection string comes from configuration backed by Key Vault, never a literal
builder.Services.AddStackExchangeRedisCache(o =>
    o.Configuration = builder.Configuration["Redis:ConnectionString"]);

public sealed class ProductCatalog(IDistributedCache cache, IProductRepository repo, ILogger<ProductCatalog> log)
{
    public async Task<Product?> GetAsync(int id, CancellationToken ct)
    {
        var key = $"product:v3:{id}";                 // version prefix allows bulk invalidation on schema change
        try
        {
            var hit = await cache.GetStringAsync(key, ct);
            if (hit is not null) return JsonSerializer.Deserialize<Product>(hit);
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException)
        {
            log.LogWarning(ex, "Cache read failed for {Key}; falling back to database", key);
        }

        var product = await repo.FindAsync(id, ct);
        if (product is null) return null;
        try
        {
            await cache.SetStringAsync(key, JsonSerializer.Serialize(product),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) }, ct);
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException)
        {
            log.LogWarning(ex, "Cache write failed for {Key}", key);
        }
        return product;
    }
}
```

- **Always set a TTL.** Entries without expiry live until evicted and serve stale data indefinitely.
- **Invalidate on write**: delete the key after the database commit (not before), or bump the version prefix. Accept that cache-aside is eventually consistent for the TTL window.
- **Stampede protection**: when a hot key expires, many requests rebuild it at once. Add TTL jitter, a short lock (`SET key value NX PX`) around rebuild, or refresh ahead of expiry.
- Cache serialized DTOs, not ORM entities with lazy-loading proxies; keep values small (large values cause timeouts).
- Do not cache errors or empty results for long; cache "not found" briefly if lookups for missing keys are hot.

## Connections and clients

- Create one `ConnectionMultiplexer` per process and reuse it (register as a singleton). Opening and closing a connection per request, as in naive examples, exhausts connections and adds handshake latency.
- Set `abortConnect=false` so the app starts and reconnects when the cache is briefly unavailable, and set sensible connect and sync timeouts.
- For Entra ID auth with StackExchange.Redis use the `Microsoft.Azure.StackExchangeRedis` extension with `DefaultAzureCredential`; for other languages use their Azure identity libraries with the Redis client.
- `RedisTimeoutException` usually means a large value, a blocking command (`KEYS *`), client thread-pool starvation, or high server load; check those before scaling up. Never run `KEYS` in production; use `SCAN`.

## Beyond caching

- Distributed session state lets App Service scale out without ARR affinity; size the cache for it and treat its loss as users being logged out.
- Lists, sorted sets, counters and pub/sub support leaderboards, rate limiting and lightweight notifications. Pub/sub is fire-and-forget; use Service Bus or Event Hubs when messages must not be lost.
- Persistence (RDB/AOF) and geo-replication on higher tiers reduce cold-start pain; they do not make Redis a system of record.

## Eviction and memory

- Choose `maxmemory-policy` deliberately: `allkeys-lru` for a pure cache, `volatile-lru` (the Azure default) when only keys with TTLs may be evicted. Under `volatile-*`, keys without TTLs are never evicted and can fill memory.
- Reserve memory for non-cache operations (`maxmemory-reserved`, `maxfragmentationmemory-reserved`) per tier guidance.

## Monitor

- Alert on server load, used memory percentage, evicted keys, connected clients, cache misses rate and errors; correlate with app latency in Application Insights.
- A falling hit ratio after a deployment usually means a key format change or missing TTL logic.

## Workflow
1. Confirm the read is repeated and recomputable, and decide what staleness is acceptable (TTL).
2. Confirm tenant, subscription, region (same as app) and environment; choose service and tier.
3. Provision via Bicep or CLI with TLS 1.2, private access and Entra ID auth; review what-if and get approval for production.
4. Wire the client as a singleton with configuration from Key Vault or managed identity.
5. Implement cache-aside with TTLs, versioned keys, invalidation after writes and fallback on cache failure.
6. Load test: measure hit ratio, latency and database load with and without the cache, including a cache outage.
7. Add alerts and a runbook for reboot, scale, failover and key rotation.

## Red flags
- Access keys or connection strings in `web.config`, `appsettings.json`, controller code or chat.
- Non-TLS port enabled or a public cache with no firewall.
- New `ConnectionMultiplexer` per request.
- Cache entries without TTLs; no invalidation on writes.
- Personalized pages output-cached without varying by user.
- App fails or throws to users when Redis is unreachable.
- Treating Redis as the only copy of important data.
- `KEYS *`, `FLUSHALL` or reboots run on production without approval.

## Related
- `../AppService/appService.md` — scale-out, session affinity and Key Vault references.
- `../WebJobs/webJobs.md` — sharing locks and cached data with background jobs.
- `../SqlDatabase/sqlDatabase.md`, `../DocumentDb/documentDb.md` — the systems of record behind the cache.
- `../../AWS/Resilience/DataProtection/dataProtection.md` — encryption in flight and at rest on AWS; configuration differs.
- `../../Practices/Monitoring/monitoring.md` — metrics and alerting practice.
- `../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — caching as a scalability tool.
- `../../../DataSystems/DistributedData/Replication/replication.md` (when installed) — staleness and read-your-writes anomalies.
- `../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — degrading gracefully on dependency failure.
