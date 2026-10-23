---
name: azure-webjobs
description: How to run background work alongside an Azure App Service app with WebJobs — continuous vs triggered (scheduled CRON or manual) jobs, settings.job with schedule, is_singleton and stopping_wait_time, supported script types, App_Data/jobs folder layout and zip deployment, Always On, graceful shutdown via WEBJOBS_SHUTDOWN_FILE, scale-out behavior, idempotency and retries, secrets through app settings and Key Vault, logs and the Kudu WebJobs API, and when to choose Azure Functions, Container Apps jobs or Logic Apps instead, based on Chapter 5 (Background Routines with Azure WebJobs) of Azure: Coloque suas plataformas e serviços no cloud. Use when the user needs a scheduled task, cron job, queue consumer, email sender, thumbnail generator or log purge for an App Service app, runs az webapp webjob, writes settings.job, sees a WebJob stuck in Pending Restart, not firing on schedule, running twice after scale-out, or stopped after idle, asks about Azure Scheduler, or wants to move a console app or script into the cloud as a background process.
---

# Azure WebJobs

A WebJob is a script or executable that runs inside an App Service app's sandbox, sharing its plan's CPU, memory, file system and app settings. Use it for modest background work tightly coupled to one web app; when the job needs independent scaling, event triggers at volume, or isolation from web traffic, use Azure Functions or Container Apps jobs instead. Write every job to be idempotent, restartable and free of embedded secrets.

## Choose the job type

| Type | Runs | Fits |
|---|---|---|
| Continuous | Starts with the app and is restarted if it exits; by default on every instance | Queue consumers, watchers |
| Triggered, scheduled | On a CRON schedule in `settings.job`, on one instance | Nightly purge, periodic reports, digest emails |
| Triggered, manual | When invoked from the portal, CLI or API | Ad-hoc maintenance, backfills |

Current note: the book schedules jobs through Azure Scheduler, which was retired (replaced by Azure Logic Apps); schedules now live in `settings.job` as CRON expressions. WebJobs were long Windows-only; support for Linux code and custom containers was added later, so check current support for your plan and OS before relying on it.

## Choose WebJobs or something else

| Need | Prefer |
|---|---|
| Small job, same codebase and config as the web app, low volume | WebJobs |
| Event-driven (queue, blob, Event Hubs, Service Bus, timer) with automatic scale | Azure Functions |
| Containerized batch or scheduled job, scale to zero | Container Apps jobs |
| Workflow orchestration across SaaS connectors, approvals | Logic Apps |
| Heavy CPU (image or video processing at volume) | Functions on a dedicated plan, Container Apps, or Batch |

A busy job competes with web requests for the same plan; if response times rise when the job runs, move it out.

## Layout and configuration

Supported file types include `.cmd`, `.bat`, `.exe`, `.ps1`, `.sh`, `.py`, `.php`, `.js` and `.jar`. The platform runs `run.*` (or the first supported file) in the job folder.

```
site/wwwroot/App_Data/jobs/
├── continuous/order-events/run.sh
└── triggered/nightly-purge/
    ├── run.py
    └── settings.job
```

```json
{
  "schedule": "0 30 2 * * *",
  "stopping_wait_time": 60
}
```

- The CRON format has six fields, seconds first: `{second} {minute} {hour} {day} {month} {day-of-week}`. `0 30 2 * * *` is 02:30 daily. Times are UTC unless the `WEBSITE_TIME_ZONE` app setting changes it (Windows); state the zone explicitly in reviews.
- For a continuous job that must run on only one instance, add `"is_singleton": true`.
- Turn on **Always On** (Basic tier or above). Without it the app idles out, continuous jobs stop and scheduled jobs do not fire.

## Deploy

- Ship jobs in the same build artifact as the app (under `App_Data/jobs/...`) and deploy through the pipeline; avoid uploading zips through the portal, which leaves no record of what is running.
- Build in Release configuration and pin dependency versions; the job runs whatever is in the folder.

```bash
az account show -o table
az webapp webjob triggered list -g rg-shop-prod -n app-shop-prod-001 -o table
az webapp webjob triggered run  -g rg-shop-prod -n app-shop-prod-001 --webjob-name nightly-purge   # with approval in prod
az webapp webjob triggered log  -g rg-shop-prod -n app-shop-prod-001 --webjob-name nightly-purge
az webapp webjob continuous stop -g rg-shop-prod -n app-shop-prod-001 --webjob-name order-events
```

- Jobs deployed with the app also move with slot swaps. A job running in the staging slot against production data is a classic incident; disable jobs in non-production slots with a slot-sticky setting the code checks, or stop them explicitly.

## Write jobs that survive the platform

- **Graceful shutdown**: on stop, restart or deployment the platform creates the file named in `WEBJOBS_SHUTDOWN_FILE` and waits `stopping_wait_time` seconds before killing the process. Check for it between units of work.

```bash
#!/usr/bin/env bash
set -euo pipefail
while [ ! -f "${WEBJOBS_SHUTDOWN_FILE:-/nonexistent}" ]; do
  python process_next_batch.py      # handles one bounded batch, commits, exits
  sleep 5
done
echo "shutdown requested, exiting cleanly"
```

- **Idempotency**: assume every scheduled run can happen twice or be cut off halfway (restarts, scale events, overlapping runs). Use processed-message markers, upserts and checkpoints so reruns are safe.
- **Bounded work**: process in batches that finish well within the stop timeout; do not hold a transaction across the whole run.
- **Retries with backoff** for transient failures (HTTP, SMTP, database), and a poison path (dead-letter queue or failure table) for items that keep failing.
- **No secrets in code**: the job reads the app's settings as environment variables. Store credentials as Key Vault references or, better, use the app's managed identity to reach Storage, Service Bus, SQL or Key Vault.
- **Email**: use a transactional email service (Azure Communication Services Email or a provider API) with credentials from Key Vault; never a personal mailbox with its password in source.
- **External input** (feeds, files, queues) can be malformed: validate, log what was skipped, and keep going rather than crashing the loop.

## Observe

- Logs and run history appear in the portal (WebJobs blade), via `az webapp webjob ... log`, and through the Kudu API (`https://<app>.scm.azurewebsites.net/api/triggeredwebjobs/<name>/history`), which requires authentication; never share those credentials.
- Send structured logs to Application Insights; emit a success heartbeat per run and alert when a scheduled job has not succeeded within its expected window, not only when it errors.
- Track duration and backlog (queue length) so you see a job falling behind before it fails.

## Workflow
1. Confirm tenant, subscription, app, slot and environment; check the plan tier supports Always On.
2. Decide WebJobs vs Functions, Container Apps jobs or Logic Apps from volume, scaling and isolation needs.
3. Choose continuous or triggered; write `settings.job` with schedule, time zone assumption and singleton needs.
4. Implement idempotent, batched work with shutdown checks, retries and a poison path; read secrets from settings backed by Key Vault or use managed identity.
5. Add the job to the app's artifact and deploy through CI to a staging slot with jobs disabled there.
6. Swap or deploy to production with approval; trigger once manually if needed and verify logs and side effects.
7. Add heartbeat, duration and backlog alerts; document how to stop the job quickly.

## Red flags
- SMTP, database or API passwords hard-coded in the job or committed in config.
- Continuous jobs on a plan without Always On, or on Free/Shared tiers.
- A job that sends emails or charges customers with no idempotency key, after a scale-out to several instances.
- Scheduled jobs whose time zone nobody can state.
- Jobs running in staging or test slots against production resources.
- CPU-heavy jobs on the same plan as a latency-sensitive site.
- No alert for "job did not run" — only for "job threw".
- Jobs uploaded by hand through the portal with no source in the repository.

## Related
- `../AppService/appService.md` — the plan, slots, Always On and settings the job depends on.
- `../RedisCache/redisCache.md` — locks and caching shared between web app and jobs.
- `../TableStorage/tableStorage.md` — simple checkpoints and processed markers.
- `../../AWS/Delivery/LambdaDeployments/lambdaDeployments.md` — AWS counterpart for event-driven background work; syntax and triggers differ.
- `../../AWS/Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — scheduled and event-driven triggers on AWS.
- `../../Practices/Monitoring/monitoring.md` — alerting on absence of success.
- `../../../DataSystems/DerivedData/BatchProcessing/batchProcessing.md` (when installed) — batch job design and reruns.
- `../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — failure handling inside long-running loops.
