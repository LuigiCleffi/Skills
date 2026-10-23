---
name: aws-cloudwatch-and-xray
description: How to collect logs and host metrics with the unified CloudWatch agent (IAM instance role, config files in Parameter Store, run_as_user, append-config, append_dimensions, cross-account role_arn), organize CloudWatch Logs (log groups, streams, retention, metric filters, subscription filters, Logs Insights, data protection), build metric and composite alarms with SNS, Auto Scaling, EC2 and Systems Manager actions, and trace distributed and serverless applications with AWS X-Ray or OpenTelemetry (traces, segments, subsegments, service map, Lambda active tracing, cold starts), based on Chapter 14 (CloudWatch and X-Ray's Role in DevOps) of AWS Certified DevOps Engineer - Professional. Use when the user wants to install or configure amazon-cloudwatch-agent, amazon-cloudwatch-agent-ctl fetch-config, CloudWatchAgentServerPolicy, mem_used_percent or disk metrics missing from EC2, logs not showing up in CloudWatch Logs, set log retention because of a growing CloudWatch bill, create a metric filter, put-metric-alarm, a composite alarm, set-alarm-state to test an alarm, an alarm stuck in INSUFFICIENT_DATA, SNS email alerts, enable X-Ray TracingConfig Mode Active on Lambda, instrument code with the X-Ray SDK or ADOT, read a service map, or find where latency comes from across microservices.
---

# CloudWatch and X-Ray

CloudWatch answers "is it healthy and what happened" (metrics, logs, alarms); X-Ray answers "where in the request path did time or errors go" (traces). Collect with the unified agent using an instance role, give every log group a retention period, alarm on symptoms users feel, and add tracing once a request crosses more than one service. Agents, alarms and tracing change IAM roles and running hosts, so confirm the account, region and environment first, and get approval before touching production.

## Where each signal belongs

| Question | Use |
|---|---|
| CPU, network, status checks of EC2, RDS, ELB, Lambda | Built-in service metrics (no agent) |
| Memory, disk space, processes, OS and app log files on EC2 or on-premises | Unified CloudWatch agent |
| Count errors or extract numbers from log lines | Metric filter on the log group |
| Ad hoc search and aggregation over logs | CloudWatch Logs Insights |
| Page someone or trigger automation on a threshold | Metric alarm, composite alarm |
| Latency and errors per hop in a distributed request | X-Ray or OpenTelemetry traces |
| Ship logs elsewhere in near real time | Subscription filter (see `../EnterpriseLogging/enterpriseLogging.md`) |

## Unified CloudWatch agent

- Authenticate with an IAM role (instance profile) on EC2. On-premises servers need credentials: prefer Systems Manager hybrid activation or IAM Roles Anywhere over long-lived access keys in a credentials file.
- Minimum role: the managed `CloudWatchAgentServerPolicy`, plus `AmazonSSMManagedInstanceCore` if you manage the agent and sessions through Systems Manager. Use `CloudWatchAgentAdminPolicy` only on the one host that writes configs to Parameter Store.
- Install through Systems Manager (`AWS-ConfigureAWSPackage` with `AmazonCloudWatchAgent`) or bake it into the AMI; avoid ad hoc downloads on running hosts.
- Store the config in Parameter Store and load it the same way everywhere:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c ssm:/cwagent/linux/base
# layer a team-specific config on top of the baked-in base config
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a append-config -m ec2 -s -c ssm:/cwagent/linux/nginx
```

- A trimmed config:

```json
{
  "agent": { "run_as_user": "cwagent", "metrics_collection_interval": 60 },
  "metrics": {
    "namespace": "CWAgent",
    "append_dimensions": { "InstanceId": "${aws:InstanceId}", "AutoScalingGroupName": "${aws:AutoScalingGroupName}" },
    "aggregation_dimensions": [["AutoScalingGroupName"]],
    "metrics_collected": {
      "mem":  { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["used_percent"], "resources": ["/"] }
    }
  },
  "logs": {
    "logs_collected": { "files": { "collect_list": [
      { "file_path": "/var/log/nginx/error.log", "log_group_name": "/app/prod/nginx-error",
        "log_stream_name": "{instance_id}", "retention_in_days": 30 }
    ] } }
  }
}
```

- `run_as_user` keeps the agent off root where policy forbids it; that user must be able to read the log files.
- `append_dimensions` and `aggregation_dimensions` control how metrics roll up. Every distinct dimension combination is a separately billed custom metric, so do not add high-cardinality values (request IDs, user IDs).
- `role_arn` in the `agent` or `credentials` section sends data to a central monitoring account; the target role must trust the source role.
- Check the agent with `amazon-cloudwatch-agent-ctl -a status` and its log at `/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log`.

Current note: the book installs the agent on Ubuntu 16.04 with `wget` in user data; use a supported OS, the Systems Manager package or a baked AMI, and the `ssm:` config source instead.

## CloudWatch Logs

- **Log event**: one UTF-8 record. **Log stream**: events from one source (an instance, a container, a Lambda execution environment). **Log group**: streams that share retention, permissions, metric filters and subscriptions.
- Retention defaults to never expire. Set it on every log group, in code, and match it to compliance needs; archive older data to S3 if it must be kept longer for less.

```bash
aws logs put-retention-policy --log-group-name /app/prod/nginx-error --retention-in-days 30
```

- Name groups by environment and component (`/app/prod/orders-api`) so IAM policies and queries can target them with prefixes.
- Encrypt sensitive groups with a KMS key (`associate-kms-key`), and add a data protection policy to mask PII or credentials that slip into logs. Better: never log secrets in the first place.
- Metric filter to turn log lines into a metric you can alarm on:

```bash
aws logs put-metric-filter --log-group-name /app/prod/orders-api \
  --filter-name errors --filter-pattern '{ $.level = "ERROR" }' \
  --metric-transformations metricName=OrdersApiErrors,metricNamespace=App/Prod,metricValue=1,defaultValue=0
```

- Logs Insights for investigation:

```
fields @timestamp, @message
| filter level = "ERROR"
| stats count(*) as errors by bin(5m)
| sort errors desc
```

- Log structured JSON from applications; JSON filter patterns and Insights fields work far better than regexes over free text.

## Alarms

- **Metric alarm**: one metric (or a metric math expression or anomaly detection band), a threshold, a period, and "M out of N datapoints". **Composite alarm**: a rule over other alarms' states, used to cut noise (page only when errors are high AND latency is high).
- Actions: SNS notification, EC2 stop/terminate/reboot/recover, Auto Scaling policy, Systems Manager OpsItem or incident.
- Define alarms in CloudFormation, CDK or Terraform beside the resource they watch, not by hand.

```yaml
HighMemoryAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: prod-orders-high-memory
    Namespace: CWAgent
    MetricName: mem_used_percent
    Dimensions: [{ Name: AutoScalingGroupName, Value: !Ref OrdersAsg }]
    Statistic: Average
    Period: 60
    EvaluationPeriods: 5
    DatapointsToAlarm: 4
    Threshold: 85
    ComparisonOperator: GreaterThanThreshold
    TreatMissingData: missing
    AlarmActions: [!Ref OpsTopic]
    OKActions: [!Ref OpsTopic]
```

- Choose `TreatMissingData` deliberately: `breaching` for heartbeat-style metrics where silence means down, `notBreaching` for sparse error counts, `missing` otherwise. An alarm in `INSUFFICIENT_DATA` usually means wrong dimensions, wrong namespace, or a metric that is not being published.
- Test notification wiring with `aws cloudwatch set-alarm-state --alarm-name ... --state-value ALARM --state-reason test`, in a non-production alarm or after warning the on-call team; it fires real actions.
- Alarm names are ASCII only and alarms are regional; quotas apply per account and region.
- SNS email subscriptions need confirmation; for paging, route to a chat or incident tool rather than individual inboxes.

## X-Ray tracing

- A **trace** follows one request end to end via a trace ID; **segments** are the work done by one service; **subsegments** break that down (downstream calls, SQL, custom blocks). Annotations are indexed key-value pairs you can filter on; metadata is not indexed.
- The service map shows nodes with latency and error/fault rates; use it to find the slow or failing hop, then open individual traces.
- Instrument code with an SDK (or OpenTelemetry), run a daemon or collector that forwards to the X-Ray API, and grant `AWSXRayDaemonWriteAccess` to the instance, task or function role. Code can run outside AWS if it can reach the API with credentials.
- Use sampling rules; tracing every request at high volume costs money and adds overhead.
- Lambda: enable active tracing so Lambda samples and records requests even when the caller is not instrumented, and the trace shows the initialization (cold start) segment separately from the invocation.

```yaml
OrdersFunction:
  Type: AWS::Serverless::Function
  Properties:
    Tracing: Active          # SAM; for AWS::Lambda::Function use TracingConfig: { Mode: Active }
```

- API Gateway, SNS, SQS and Step Functions can propagate trace headers; enable tracing on each to get a connected map.

Current note: AWS now recommends OpenTelemetry (AWS Distro for OpenTelemetry, or the CloudWatch agent's OTLP support) for new instrumentation; the X-Ray SDKs and daemon are in maintenance mode. Traces still land in X-Ray and CloudWatch (Application Signals, Transaction Search). Prefer OpenTelemetry for new services so instrumentation stays portable.

## Workflow
1. Confirm account (`aws sts get-caller-identity`), region and environment; state what will be installed or created and get approval for production hosts and IAM changes.
2. Decide the signals: built-in metrics, agent metrics, log files, traces. Write down the user-facing symptoms worth alarming on.
3. Create or update the least-privilege role and instance profile in code; review the change set or plan.
4. Put agent configs in Parameter Store, roll the agent out through Systems Manager to a canary host first, then the fleet.
5. Create log groups in code with retention, KMS where needed, and metric filters.
6. Create alarms in code with explicit `TreatMissingData`, OK actions, and a tested notification path.
7. Add tracing (OpenTelemetry or X-Ray) with sampling; verify a trace shows every hop.
8. Verify: metrics appear with the expected dimensions, log streams receive events, alarms leave `INSUFFICIENT_DATA`, a test alert reaches the on-call channel. Record rollback (previous agent config parameter version, previous stack).

## Red flags
- Access keys stored on EC2 instances for the agent instead of an instance role.
- Log groups with no retention; nobody knows what CloudWatch Logs costs per month.
- Secrets, tokens or full request bodies with PII written to logs.
- Custom dimensions with unbounded cardinality multiplying metric cost.
- Alarms on CPU only, nothing on errors, latency or saturation users would notice.
- Alarms that notify a single person's email, or have no OK action so nobody knows when it cleared.
- Alarms and dashboards created by hand in the console with no code behind them.
- `set-alarm-state` run on a production alarm wired to Auto Scaling or EC2 actions.
- Tracing at 100% sampling in a high-traffic service; tracing enabled on only one hop, so the map ends abruptly.

## Related
- `../MetricsAndEventBridge/metricsAndEventBridge.md` — metrics model, custom metrics, dashboards, EventBridge rules.
- `../LogSources/logSources.md` — CloudTrail, ELB access logs and VPC Flow Logs into CloudWatch Logs.
- `../EnterpriseLogging/enterpriseLogging.md` — subscription filters to OpenSearch, Firehose, Athena.
- `../../Delivery/LambdaDeployments/lambdaDeployments.md` — Lambda versions and aliases you trace and alarm on.
- `../../Resilience/AutoScaling/autoScaling.md` — alarms driving scaling policies.
- `../../Resilience/SystemsManagerAndConfig/systemsManagerAndConfig.md` — Run Command, Parameter Store, Session Manager for agent rollout.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — instance roles and least privilege.
- `../../../Practices/Monitoring/monitoring.md` — platform-neutral monitoring practice; the Azure counterpart (Azure Monitor, Application Insights) uses different syntax and agents, do not mix them.
- `../../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` (when installed) — describing load and percentiles for latency alarms.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — what errors to log and how.
- `../../../../actions/review.md` (when installed) — reviewing infrastructure changes.
