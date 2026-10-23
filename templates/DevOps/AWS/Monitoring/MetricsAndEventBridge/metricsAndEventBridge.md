---
name: aws-metrics-and-eventbridge
description: How CloudWatch metrics work (namespaces, dimensions, statistics and percentiles, periods, regional scope, 15-month retention, basic vs detailed EC2 monitoring, burstable CPU credits), how to publish custom and high-resolution business and application metrics (PutMetricData, StorageResolution, Embedded Metric Format), build and share CloudWatch dashboards, export metrics with metric streams, and automate reactions with Amazon EventBridge (event buses, rules, event patterns, targets, input transformers, retries and DLQs, archive and replay, cross-account buses, SaaS partner sources, Scheduler), based on Chapter 15 (CloudWatch Metrics and Amazon EventBridge) of AWS Certified DevOps Engineer - Professional. Use when the user wants to choose which metrics to watch for EC2, Lambda, RDS, S3 or ELB, publish a KPI with aws cloudwatch put-metric-data or boto3 put_metric_data, get sub-minute metrics, can not find a custom metric or dimension, sees custom metric costs rising, wants a dashboard in CloudFormation (AWS::CloudWatch::Dashboard) or to share one with stakeholders, stream metrics to S3 or a third-party tool via Firehose, react to EC2 Instance State-change Notification, write an EventBridge event pattern, put-rule or put-targets, migrate CloudWatch Events rules or cron schedules, or debug a rule that never fires.
---

# CloudWatch Metrics and EventBridge

A metric is a regional, time-ordered series identified by namespace, name and dimensions; you query it as statistics over a period. Watch a few metrics per service that reflect user-facing health, publish business KPIs as custom metrics, and use EventBridge rules so the platform reacts to events instead of people polling consoles. Rules and targets can start, stop or modify resources, so confirm the account, region and environment, and review targets and permissions before enabling a rule in production.

## Metric model

- **Namespace**: container, `AWS/EC2`, `AWS/Lambda`, or your own like `App/Prod`. Never publish into an `AWS/` namespace.
- **Dimensions**: name/value pairs; each unique combination is a distinct metric. You must query with the exact dimension set it was published with.
- **Statistics**: Average, Minimum, Maximum, Sum, SampleCount, and percentiles (p50, p90, p99) for latency. Prefer percentiles over Average for latency.
- **Period and resolution**: standard resolution is 1 minute; high resolution down to 1 second. Data older than a few hours is rolled up to coarser periods.
- Metrics are regional, cannot be deleted, and expire after 15 months. Metrics from terminated instances, deleted load balancers and volumes remain queryable until then.
- The console search does not match ARNs; search by instance ID, function name, metric name or namespace.

## What to watch by default

| Service | Metrics |
|---|---|
| EC2 | `CPUUtilization`, `StatusCheckFailed` (instance and system), network in/out; `CPUCreditBalance` on T-family; memory and disk only via the agent |
| Lambda | `Errors`, `Throttles`, `Duration` (p99), `ConcurrentExecutions`, `IteratorAge` for stream sources |
| RDS | `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace`, `DiskQueueDepth`, `ReplicaLag` |
| ALB | `HTTPCode_Target_5XX_Count`, `TargetResponseTime` (p99), `HealthyHostCount`/`UnHealthyHostCount`, `RejectedConnectionCount` |
| SQS | `ApproximateAgeOfOldestMessage`, `ApproximateNumberOfMessagesVisible` |
| S3 | `NumberOfObjects`, `BucketSizeBytes` (daily); request metrics need enabling |

- EC2 basic monitoring publishes every 5 minutes at no charge; detailed monitoring (1 minute) costs extra and is worth it for instances behind scaling policies.
- A passing status check means the instance is reachable, not that the application works. Pair it with load balancer health and application error metrics.
- A T-family instance with a draining `CPUCreditBalance` will be throttled to baseline (standard mode) or bill surplus credits (unlimited mode); alarm on it or pick a non-burstable type.

## Custom metrics

- Publish counts and KPIs the business cares about (signups, orders, failed payments) and application signals the platform cannot see (queue depth in your own system, cache hit rate).
- Grant only `cloudwatch:PutMetricData`, optionally restricted with the `cloudwatch:namespace` condition key:

```json
{
  "Effect": "Allow",
  "Action": "cloudwatch:PutMetricData",
  "Resource": "*",
  "Condition": { "StringEquals": { "cloudwatch:namespace": "App/Prod" } }
}
```

- CLI, with a high-resolution flag:

```bash
aws cloudwatch put-metric-data --namespace App/Prod --metric-name CheckoutCompleted \
  --dimensions Service=checkout,Channel=web --unit Count --value 1 --storage-resolution 1
```

- From code, batch datapoints per call rather than one API call per event:

```python
import boto3
cloudwatch = boto3.client("cloudwatch")

def record_checkout(channel: str, item_count: int) -> None:
    cloudwatch.put_metric_data(
        Namespace="App/Prod",
        MetricData=[
            {"MetricName": "CheckoutCompleted", "Dimensions": [{"Name": "Channel", "Value": channel}],
             "Unit": "Count", "Value": 1},
            {"MetricName": "CartSize", "Dimensions": [{"Name": "Channel", "Value": channel}],
             "Unit": "Count", "Value": item_count},
        ],
    )
```

- In Lambda and containers, prefer the Embedded Metric Format: write a structured JSON log line and CloudWatch extracts the metric asynchronously, with no API call in the request path.
- High resolution (1 second) costs more and alarms on it can evaluate at 10 or 30 seconds; use it only for short spikes that 1-minute data hides.
- Keep dimension values low-cardinality (service, environment, channel), never user or request IDs.

## Dashboards

- Define dashboards in code (`AWS::CloudWatch::Dashboard` with a JSON `DashboardBody`, CDK, or Terraform) so they are reviewed and reproducible.
- Put the few signals that answer "is it healthy" at the top (errors, latency p99, saturation, traffic), then per-component detail, a logs table widget for recent errors, and a text widget linking to the runbook.
- Dashboards are global (not regional) and can mix regions and accounts; automatic dashboards exist per service for a quick start.
- Sharing with people outside the account: share a single dashboard with specific email addresses (backed by Amazon Cognito usernames and passwords), use SSO, or make it public. Public sharing exposes the data to anyone with the link; get explicit approval and never use it for dashboards that show customer data or internal hostnames.
- For multiple accounts, set up CloudWatch cross-account observability (a monitoring account linked to source accounts) instead of copying metrics.

## Metric streams

- Continuously stream metrics through Amazon Data Firehose to S3, a data lake, or a third-party observability tool, in JSON or OpenTelemetry format. Cheaper and fresher than a vendor polling `GetMetricData`.
- Filter by namespace (and metric name) to control volume and cost.

Current note: Kinesis Data Firehose is now named Amazon Data Firehose.

## EventBridge

- **Event bus**: the router. The default bus receives AWS service events; create custom buses for your own application events; partner event sources connect SaaS providers without cross-account credentials.
- **Rule**: an event pattern (or a schedule) on a bus; matching events go to up to five **targets** (Lambda, Step Functions, SQS, SNS, Kinesis, ECS tasks, CloudWatch Logs, API destinations, another bus).
- Event pattern that matches instances entering `pending` or `terminated`:

```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": { "state": ["pending", "terminated"] }
}
```

```bash
aws events put-rule --name prod-ec2-lifecycle --event-pattern file://pattern.json
aws events put-targets --rule prod-ec2-lifecycle \
  --targets 'Id=notify,Arn=arn:aws:sns:us-east-2:111122223333:ops-events'
```

- Prefer CloudFormation or CDK (`AWS::Events::Rule`) over CLI so rules, targets and permissions ship together.
- Targets need permission to be invoked: a resource policy on the Lambda function, SNS topic, SQS queue or CloudWatch Logs log group that allows `events.amazonaws.com`, scoped with `aws:SourceArn` to the rule. Targets like ECS or Step Functions need an IAM role the rule assumes.
- Configure a retry policy and a dead-letter queue on each target; failed deliveries are otherwise dropped silently.
- Use input transformers to send targets only the fields they need.
- Archive and replay events to reprocess after a bug fix; the schema registry can generate code bindings for event shapes.
- Matching is exact and case-sensitive. Test patterns with `aws events test-event-pattern` before deploying.
- Guard against loops: a target that produces an event matching its own rule (for example, a function that writes to the bucket that triggers it) runs forever and bills accordingly.
- Quotas (rules per bus, invocation and PutEvents rates) are per region and mostly adjustable; check them for high-volume buses.

Current note: CloudWatch Events is now EventBridge; old rules live on the default bus and keep working. For cron and rate schedules, use EventBridge Scheduler (one-time and recurring schedules, time zones, higher scale) rather than scheduled rules.

## Workflow
1. Confirm account, region and environment; for rules that act on resources, get approval for the production target.
2. List the user-facing symptoms and business KPIs; map each to a built-in or custom metric with explicit dimensions.
3. Add least-privilege publishing permissions and the metric code (EMF or batched `PutMetricData`); verify the metric appears with the expected dimensions.
4. Build the dashboard in code; review who it is shared with.
5. For automation, write the event pattern, test it with `test-event-pattern`, and define rule, target, target permissions, retry policy and DLQ in one stack. Review the change set.
6. Deploy to a non-production account or a disabled rule first; trigger a real event and confirm the target ran.
7. Enable in production, alarm on the DLQ depth and target failures (`FailedInvocations`), and document how to disable the rule quickly as the rollback.

## Red flags
- Alarming on Average latency while p99 is what users feel.
- Custom metrics with user IDs, request IDs or timestamps as dimensions.
- One `PutMetricData` call per request on a hot path instead of EMF or batching.
- Dashboards shared publicly, or built by hand and lost when someone edits them.
- EventBridge rules without a DLQ, or targets with resource policies open to any rule (`events.amazonaws.com` without `aws:SourceArn`).
- Rules that terminate, stop or modify resources deployed straight to production without a dry run.
- Event patterns that are too broad (`"source": ["aws.ec2"]` alone) feeding an action target.
- Recursive event loops between a rule and its own target.
- New scheduled rules where EventBridge Scheduler fits better.

## Related
- `../CloudWatchAndXRay/cloudWatchAndXRay.md` — agent metrics, alarms, tracing.
- `../LogSources/logSources.md` — CloudTrail events that EventBridge rules can match.
- `../EnterpriseLogging/enterpriseLogging.md` — Firehose, OpenSearch and Athena downstream of streams.
- `../../Delivery/LambdaDeployments/lambdaDeployments.md` — Lambda targets and their versions.
- `../../Resilience/AutoScaling/autoScaling.md` — metrics behind scaling policies.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — automation runbooks as EventBridge targets.
- `../../../Practices/Monitoring/monitoring.md` — platform-neutral metrics and alerting practice; Azure Monitor metrics and Event Grid are different services with different syntax.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` (when installed) — event-driven and stream processing design.
- `../../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — percentiles and load parameters.
- `../../../../actions/dev.md` (when installed) — implementation workflow.
