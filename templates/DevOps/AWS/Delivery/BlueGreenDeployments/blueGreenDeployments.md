---
name: aws-blue-green-deployments
description: How to plan and run blue/green and canary releases on AWS (blue and green environments, deciding the environment boundary, immutable infrastructure, Route 53 weighted alias records and TTLs, ALB weighted target groups, swapping Auto Scaling groups behind a load balancer, launch template updates with instance refresh, CodeDeploy blue/green for EC2, ECS and Lambda, ECS service swaps, Elastic Beanstalk clone and Swap Environment URLs, Lambda weighted aliases, legacy OpsWorks stack cloning, CloudWatch alarms as promotion gates, rollback, cost of double capacity, and data tier rules: snapshots, expand and contract schema changes, backward-compatible migrations, RDS Blue/Green Deployments), based on Chapter 13 (Blue Green Deployments) of AWS Certified DevOps Engineer - Professional. Use when the user wants zero-downtime releases, a canary or gradual traffic shift, a fast rollback path, to switch traffic between two stacks, environments, target groups, Auto Scaling groups or regions, runs aws route53 change-resource-record-sets with Weight or SetIdentifier, aws elbv2 modify-listener with ForwardConfig, aws autoscaling start-instance-refresh, aws elasticbeanstalk swap-environment-cnames, configures a CodeDeploy blue/green deployment group, asks why traffic still hits the old version after a DNS switch, or must ship a database schema change alongside a release.
---

# Blue/Green Deployments on AWS

Run the new version (green) beside the current one (blue), test green without user traffic, shift traffic with a switch you can reverse in seconds, and keep blue intact until green has proven itself. Pick the switch point closest to the application that your team controls (alias, target group, environment URL) before reaching for DNS, and solve the data tier first: two application versions will share the same data during the overlap. Traffic shifts affect production users, so confirm account, region and environment and get explicit approval before each shift.

## Decide the boundary and the switch

The environment is whatever you duplicate: one function, one service, a tier, a whole stack, or a region. Duplicate the smallest unit that contains the change; everything outside the boundary (load balancer, DNS, database) is shared and must tolerate both versions.

| Workload | Switch mechanism | Gradual shift | Rollback speed |
|---|---|---|---|
| Anything with an endpoint, incl. cross-region | Route 53 weighted alias records | Yes (weights) | Minutes to hours (TTL, client caching) |
| EC2/containers behind an ALB | ALB listener weighted forward to two target groups | Yes | Seconds |
| EC2 Auto Scaling | Attach green ASG to target group, detach blue | Coarse | Seconds to minutes |
| EC2 Auto Scaling, same group | New launch template version + instance refresh | Rolling, with checkpoints | Auto rollback or new refresh |
| EC2 / on-premises with CodeDeploy | CodeDeploy blue/green deployment group | All at once per load balancer | Re-route to retained blue |
| ECS | CodeDeploy blue/green (or native ECS blue/green) with two target groups | Canary/linear via CodeDeploy | Seconds |
| Elastic Beanstalk | Clone environment, Swap Environment URLs | No (all at once) | Swap back; DNS caching applies |
| Lambda | Alias weights, CodeDeploy canary/linear | Yes | Seconds |
| RDS/Aurora engine or parameter changes | RDS Blue/Green Deployments | No (switchover) | Old cluster retained, renamed |

Current note: the book claims CodeDeploy does blue/green for EKS; it does not. On Kubernetes use two Deployments behind a Service or Ingress with weighted routing (AWS Load Balancer Controller weighted target groups, or Argo Rollouts / Flagger).

Current note: Amazon ECS now has a built-in blue/green deployment strategy with lifecycle hooks, in addition to the CodeDeploy-based one. The book's statement that canaries are impossible with ECS swaps applies only to scaling one service down and another up; ALB weighted target groups and CodeDeploy canary configurations allow canaries.

Current note: OpsWorks stack cloning is obsolete (OpsWorks reached end of life in 2024), and Auto Scaling launch configurations are deprecated; use launch templates.

## Route 53 weighted records

```json
{"Comment": "shift 10% to green",
 "Changes": [{"Action": "UPSERT", "ResourceRecordSet": {
   "Name": "app.example.com", "Type": "A", "SetIdentifier": "green", "Weight": 10,
   "AliasTarget": {"HostedZoneId": "Z2EXAMPLEALBZONE",
                   "DNSName": "green-alb-123.eu-west-1.elb.amazonaws.com",
                   "EvaluateTargetHealth": true}}}]}
```

```bash
aws route53 change-resource-record-sets --hosted-zone-id Z0EXAMPLE --change-batch file://green-10.json
aws route53 get-change --id <ChangeId>   # wait for INSYNC
```

- Keep a matching `blue` record (weight 90, then 0). Weight 0 on both means traffic is split evenly, not stopped.
- Lower the TTL well before the release (non-alias records); resolvers and clients (JVMs, mobile apps, corporate proxies) may cache longer than the TTL, so blue keeps receiving traffic for a while and cannot be removed right after the switch.
- Use alias records to AWS endpoints and `EvaluateTargetHealth` so an unhealthy green drops out.
- Cross-region green is possible, but only if the data tier is available and consistent in that region.

## ALB weighted target groups

```bash
aws elbv2 modify-listener --listener-arn "$LISTENER_ARN" --default-actions '[{
  "Type": "forward",
  "ForwardConfig": {
    "TargetGroups": [
      {"TargetGroupArn": "'"$BLUE_TG"'",  "Weight": 90},
      {"TargetGroupArn": "'"$GREEN_TG"'", "Weight": 10}],
    "TargetGroupStickinessConfig": {"Enabled": true, "DurationSeconds": 300}}}]'
```

- No DNS change, instant rollback (set green to 0), same load balancer. Stickiness keeps a user on one version during a canary; disable it for the final cut so traffic moves.
- Test green first through a separate listener or a header/path rule only testers use.
- Set target group deregistration delay to cover in-flight requests; long-lived connections (WebSockets, streaming) are cut when targets deregister, so plan drain time.

## Auto Scaling approaches

- **Swap groups**: launch a green ASG (new AMI or user data, same target group not yet attached), test via its own instances or a test target group, attach to the production target group, then detach blue and keep it scaled for a rollback window. The load balancer is shared and stays out of the deployment.
- **Same group, instance refresh**: create a new launch template version and replace instances with full capacity maintained:

```bash
aws autoscaling start-instance-refresh --auto-scaling-group-name web-prod \
  --desired-configuration '{"LaunchTemplate":{"LaunchTemplateName":"web","Version":"7"}}' \
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,
                  "InstanceWarmup":120,"CheckpointPercentages":[10,50,100],
                  "CheckpointDelay":600,"AutoRollback":true}'
```

  This replaces the book's "double the group, then scale in" pattern. Pin an explicit template version, not `$Latest`, so the refresh is reproducible.
- **CodeDeploy blue/green for EC2**: the deployment group copies the ASG (or uses tagged instances), installs the revision on green, reroutes the load balancer, and terminates or keeps blue after a wait time. Keep blue for the rollback window (`terminationWaitTimeInMinutes`).

## Elastic Beanstalk and Lambda

```bash
# after cloning blue to my-app-green and deploying the new version there
aws elasticbeanstalk swap-environment-cnames \
  --source-environment-name my-app-blue --destination-environment-name my-app-green
```

- Test green on its own environment URL before swapping. The swap is a DNS change: TTL and caching apply, keep blue running until traffic drains.
- The database must live outside both environments; an RDS instance created inside the blue environment cannot be shared with green.
- For Lambda, move a weighted alias or use CodeDeploy canary/linear configurations; see the Lambda skill.

## Promotion gates and monitoring

- Define success before shifting: error rate, p99 latency, saturation and a business metric, compared between blue and green (separate target groups, aliases or environments give separate metrics).
- Wire CloudWatch alarms to automatic rollback where the service supports it (CodeDeploy, instance refresh, Lambda deployment preferences); otherwise make rollback a single documented command.
- Pre-warming: Application and Network Load Balancers scale automatically, but a sudden jump to full traffic on a brand-new load balancer can still outpace scaling. Shift gradually, or arrange capacity in advance (LCU reservation or AWS Support) for large planned events.

## Data tier rules

- Snapshot before any release that changes data or schema (`aws rds create-db-snapshot`, or an Aurora cluster snapshot), and test that a restore works; restoring loses writes made after the snapshot, so it is a last resort, not the rollback plan.
- Make schema changes backward compatible with the running version, and decouple them from code deploys (expand / contract):
  1. Expand before the release: add nullable columns, new tables, new indexes (concurrently where the engine supports it). Blue keeps working.
  2. Release green, which writes both old and new shapes if needed; backfill in batches.
  3. Contract after green is final and blue is gone: drop old columns or constraints in a later release.
- Split a mixed change into a non-breaking migration before and a breaking migration after the cutover.
- Never let green run a destructive migration on a database blue still uses; rollback to blue would then fail.
- Queues, caches and file formats are shared state too: green must read messages and cache entries written by blue, and the reverse during rollback.

Current note: Amazon RDS Blue/Green Deployments (MySQL, MariaDB, PostgreSQL, Aurora) create a synchronized staging copy for engine upgrades or parameter changes and switch over with minimal downtime; use them instead of hand-built replica swaps, and still treat the switchover as a production change needing approval.

## Workflow
1. Confirm account, region, environment and the exact resources (record, listener, ASG, environment, alias) the switch will touch.
2. Choose the boundary and switch mechanism from the table; confirm the data tier change is backward compatible and a snapshot exists.
3. Provision green from code (CloudFormation change set, Terraform plan, SAM change set) and review it before applying.
4. Test green without user traffic: smoke tests, health checks, its own endpoint or test listener.
5. With explicit approval, shift a small percentage; watch the agreed alarms and compare blue vs green.
6. Increase in steps to 100%, keeping the rollback command ready; roll back immediately on alarm.
7. Keep blue for an agreed window (longer when DNS is the switch), then, with approval, decommission it and run any contract migrations.

## Red flags
- No written rollback command, or blue torn down at the moment of cutover.
- Destructive or breaking schema changes deployed together with the code.
- DNS switch with a long TTL, then deleting blue minutes later.
- Green tested only after receiving production traffic.
- Both environments writing to separate databases with no reconciliation plan.
- Route 53 weights of 0/0, or stickiness left on so traffic never fully moves.
- Doubling capacity without checking EC2, IP address and service quotas.
- Treating Elastic Beanstalk URL swaps, Route 53 changes and ALB weights as interchangeable: they differ in speed, caching and rollback behavior.
- Secrets copied into green's templates or user data instead of referenced from Secrets Manager or Parameter Store.

## Related
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — CodeDeploy blue/green deployment groups and pipeline gates.
- `../ElasticBeanstalk/elasticBeanstalk.md` — Beanstalk deployment policies and URL swap.
- `../LambdaDeployments/lambdaDeployments.md` — alias weights and SAM traffic shifting.
- `../CloudFormation/cloudFormation.md` — provisioning green from templates with change sets.
- `../OpsWorks/opsWorks.md` — migrating legacy OpsWorks stacks that relied on cloning.
- `../../Resilience/AutoScaling/autoScaling.md` — launch templates, instance refresh, lifecycle hooks.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — alarms used as promotion gates.
- `../../Resilience/DataProtection/dataProtection.md` — snapshots and encryption for the data tier.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral release strategies; AWS commands do not apply elsewhere.
- `../../../Practices/AdvancedTopics/advancedTopics.md` — platform-neutral deployment patterns.
- `../../../../DataSystems/Foundations/EncodingAndEvolution/encodingAndEvolution.md` (when installed) — backward and forward compatibility between versions.
- `../../../../DBA/PostgreSQL/TablesConstraintsIndexes/tablesConstraintsIndexes.md` (when installed) — safe schema changes in PostgreSQL.
- `../../../../actions/review.md` (when installed) — reviewing release plans.
