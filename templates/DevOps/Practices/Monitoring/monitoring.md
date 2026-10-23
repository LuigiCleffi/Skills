---
name: devops-monitoring
description: How to monitor production systems and alert on failures - external supervisor versus supervised hosts, granular checks for host resources (load average, disk space, process count, logged-in users), network services (TCP port, SSH, HTTP/HTTPS status and content, TLS), application-level checks (database login and query, health endpoints), local versus remote checks (agent pull like NRPE, passive push like NSCA, check over SSH; now Prometheus exporters, OpenTelemetry Collector, Pushgateway), the plugin exit-code contract 0 OK / 1 WARNING / 2 CRITICAL / 3 UNKNOWN, warning and critical thresholds, retries and soft/hard states, host groups and labels, contacts, time periods, notification options, recovery notices, on-call paging (PagerDuty, SMS), dependency-aware alert suppression and testing alerts, based on Chapter 3 (Monitoring) of DevOps na Pratica (Danilo Sato). Use when setting up monitoring or alerting for a service, writing a Nagios/Icinga/Sensu check script, adding Prometheus alert rules or blackbox probes, users report outages before the team notices, alerts are noisy or flapping, one database failure triggers dozens of pages, disks fill up with logs, the monitoring server runs on the host it monitors, credentials appear in check_command definitions, or someone needs to verify that paging actually works.
---

# Monitoring

Monitoring exists so that the team, not the users, discovers that production is broken. Run checks from outside the systems they watch, make each check small and specific, alert only on conditions a human must act on, and prove the alert path works before you depend on it.

## Supervisor and supervised

- The monitoring system (supervisor) collects results, evaluates health and sends notifications; production hosts and services are supervised.
- Never run the only supervisor on a host it supervises: when that host dies, so does the alert. Put it on separate infrastructure, ideally in a different failure domain, or use a hosted service.
- Monitor the monitor: a heartbeat ("dead man's switch") alert that fires when the monitoring pipeline stops sending, routed through an independent channel.

Current note: the book uses Nagios (and later Graphite). Nagios-compatible engines (Icinga, Checkmk, Sensu) still run the same plugins, but most new setups use Prometheus with Alertmanager and Grafana, OpenTelemetry for metrics, traces and logs, or the cloud provider's native monitoring.

## Choose granular checks in layers

Many specific checks beat one generic "server is unhealthy" check, for the same reason a test with one assertion pinpoints failures: the alert name should already tell the responder where to look.

| Layer | Examples | What it proves |
|---|---|---|
| Host resources | Load average vs CPU count, free disk and inodes, memory, process count, unexpected logins | The machine can do work |
| Network service | TCP connect to 5432, SSH banner, HTTP 200 on a port | Something is listening |
| Protocol / application | HTTP GET of a real page expecting status and text, DB login plus a trivial query, TLS certificate expiry | The right thing is answering correctly |
| User journey | Synthetic login or checkout from outside the network | Users can actually use it |

- A TCP check passing only means a process accepts connections; it may not be the database. Add an authenticated, read-only application check.
- Check user-facing endpoints through the same path users take (DNS, load balancer, TLS), not only the internal port.
- Watch disk space growth from logs; it is one of the most common avoidable outages. Pair the alert with log rotation.

## Local versus remote checks

Network checks run from the supervisor. Resource checks (disk, memory, processes) need data only the host has. Options:

| Model | Then | Now | Trade-off |
|---|---|---|---|
| Run the check over SSH | `check_by_ssh` | ad-hoc scripts | No agent, but a connection per check and broad SSH access for the monitor |
| Agent, supervisor pulls (active) | NRPE | Prometheus scraping `node_exporter` or app `/metrics` | Central control of schedule; agent port must be reachable and locked down |
| Host pushes results (passive) | NSCA | OpenTelemetry Collector, Pushgateway for batch jobs, cloud agents | Works through NAT and for short jobs; silence must itself alert |

Give the agent a dedicated low-privilege OS user and restrict its listening port to the monitoring network.

## Writing a check: the exit-code contract

Nagios-style checks print one status line and signal the result only through the exit code: 0 OK, 1 WARNING, 2 CRITICAL, 3 UNKNOWN (could not determine). A check that cannot reach its target should return UNKNOWN or CRITICAL deliberately, never crash with a random code.

```bash
#!/usr/bin/env bash
# check_queue_depth -w 500 -c 2000 : alert on a backlog in the orders queue
set -uo pipefail
warn=500; crit=2000
while getopts "w:c:" opt; do case $opt in w) warn=$OPTARG;; c) crit=$OPTARG;; *) exit 3;; esac; done
depth=$(curl -fsS --max-time 5 http://localhost:15672/api/queues/%2F/orders \
          --netrc-file /etc/monitoring/rabbit.netrc | jq -r '.messages') \
  || { echo "QUEUE UNKNOWN - cannot read queue depth"; exit 3; }
[[ $depth =~ ^[0-9]+$ ]] || { echo "QUEUE UNKNOWN - unexpected value '$depth'"; exit 3; }
if   (( depth >= crit )); then echo "QUEUE CRITICAL - $depth messages | depth=$depth"; exit 2
elif (( depth >= warn )); then echo "QUEUE WARNING - $depth messages | depth=$depth"; exit 1
else echo "QUEUE OK - $depth messages | depth=$depth"; exit 0; fi
```

- Credentials come from a root-owned file with mode 0600 (here a netrc), not from the command definition. The book passes a database password as a check argument; that leaks it into config files, the web UI and process lists.
- Text after `|` is performance data that graphing tools can store.
- Run the check by hand from the supervisor before wiring it in, and test each exit path.

The Prometheus equivalent expresses the same thresholds as alert rules over metrics:

```yaml
groups:
  - name: shop
    rules:
      - alert: DiskWillFillIn4Hours
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600) < 0
        for: 15m
        labels: { severity: page }
        annotations: { summary: "Disk on {{ $labels.instance }} fills within 4h" }
      - alert: ShopHomepageDown
        expr: probe_success{job="blackbox-https", instance="https://shop.example.com/"} == 0
        for: 3m
        labels: { severity: page }
```

## Reduce noise without hiding problems

- **Retries and hard states.** Require several consecutive failures (Nagios max check attempts, Prometheus `for:`) before paging, so one dropped packet does not wake anyone. Keep the window short for user-facing outages.
- **Thresholds.** WARNING should mean "look during working hours", CRITICAL "act now". If nobody acts on a warning, delete it or turn it into a ticket.
- **Groups and labels.** Define checks once for a host group or label set (web, db) instead of per host; new hosts inherit them.
- **Dependencies.** When the database is down, the web checks that depend on it also fail. Declare parent/child dependencies (Nagios) or inhibition rules (Alertmanager) so responders get the cause, not fifty symptoms.

```yaml
# Alertmanager: suppress app alerts while its database is known to be down
inhibit_rules:
  - source_matchers: [ alertname = "DatabaseDown" ]
    target_matchers: [ tier = "web" ]
    equal: [ environment ]
```

- Prefer alerting on user-visible symptoms (error rate, latency, failed probes, SLO burn rate) and use resource metrics for diagnosis dashboards.

## Notifications and on-call

- Define who is notified (contacts and groups), when (time periods such as 24x7 or business hours) and for which transitions (down, warning, critical, unknown, recovery).
- Always send recovery notifications, so responders know when an incident has cleared.
- Route pages to an on-call tool (PagerDuty or similar, or the cloud provider's notification service) that handles schedules, escalation and acknowledgement. Email alone is not paging.
- Every paging alert links to a runbook: what it means, first diagnostic commands, how to mitigate, who to escalate to.

## Test the alert path

- After configuring a new alert, trigger it deliberately in a non-production environment (stop a test service, point a probe at a closed port, or use the tool's test-notification feature) and confirm the page arrives and the recovery follows.
- Do not stop services on production hosts to test monitoring without explicit approval and a scheduled window.
- Periodically run game days: simulate the loss of a server and check that the right alerts fire, in the right order, to the right people. The book ends this chapter by destroying the database server, which shows why manual rebuilds are too slow.

## Safety

- Monitoring changes can silence real alerts. Confirm the environment, review the diff of rules and routing, and get approval before muting, deleting or rerouting production alerts.
- Use maintenance windows or silences with an expiry instead of disabling checks.
- Monitoring credentials are read-only and least privilege; store them in a secret store or protected files, never in check definitions, dashboards, logs or chat.
- Restrict access to the monitoring UI; it reveals topology and sometimes data.

## Workflow

1. List what "working" means for users and the components it depends on.
2. Stand up the supervisor outside the monitored systems, plus a heartbeat alert for itself.
3. Add host resource checks, then network service checks, then application and synthetic checks.
4. Write custom checks with the exit-code contract or as metrics plus alert rules; test every path by hand.
5. Group checks by role, set thresholds and retry windows, declare dependencies or inhibitions.
6. Configure contacts, schedules, escalation and recovery notices; attach runbooks.
7. Trigger each new alert in non-production and confirm delivery; review noisy alerts monthly.

## Red flags

- The monitoring server lives on a production host it checks, or nothing alerts when monitoring itself stops.
- Only a TCP or ping check for a database or web application.
- Passwords in `check_command`, alert annotations or dashboard queries.
- Alerts that page for conditions nobody acts on; people muting the channel.
- No recovery notifications; incidents that "probably" ended.
- One upstream failure producing a page storm with no dependency handling.
- Alerting only by email, with no on-call schedule or escalation.
- Alerts that have never been tested end to end.

## Related

- `../StartInProduction/startInProduction.md` — the system you start monitoring.
- `../InfrastructureAsCode/infrastructureAsCode.md` — rebuilding the server an alert told you died; managing monitoring config as code.
- `../AdvancedTopics/advancedTopics.md` — log aggregation, metrics and operating at scale.
- `../../AWS/Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — AWS counterpart (CloudWatch alarms, X-Ray); not interchangeable with Nagios or Prometheus syntax.
- `../../AWS/Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — AWS custom metrics and event routing.
- `../../AWS/Monitoring/LogSources/logSources.md` — AWS log sources (VPC Flow Logs, ELB logs, CloudTrail).
- `../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — faults, failures and percentiles for latency alerts.
- `../../../DataSystems/DistributedData/TroubleWithDistributedSystems/troubleWithDistributedSystems.md` (when installed) — why timeouts cannot distinguish slow from dead.
- `../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — failing with clear, actionable messages.
