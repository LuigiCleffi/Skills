---
name: aws-auto-scaling
description: How to design and operate EC2 Auto Scaling groups (min, max and desired capacity, launch templates and versions, multi-AZ subnets, ELB integration and health checks, health check grace period, default instance warmup), choose a scaling approach (manual, scheduled, dynamic target tracking, step and simple scaling, predictive scaling), set termination policies, scale-in protection, standby and suspended processes, roll out new launch template versions with instance refresh, warm pools, mixed instances with Spot, and use lifecycle hooks on launch and terminate (Pending:Wait, Terminating:Wait, heartbeat timeout, complete-lifecycle-action, EventBridge or Lambda handlers), based on Chapter 18 (Autoscaling and Lifecycle Hooks) of AWS Certified DevOps Engineer – Professional. Use when creating or tuning an ASG, aws autoscaling create-auto-scaling-group or put-scaling-policy, instances flapping in and out every few minutes, the group not scaling out under load or stuck at max size, instances replaced as unhealthy right after launch, ELB vs EC2 health check type, migrating launch configurations to launch templates, start-instance-refresh, scheduled scaling for business hours or an event, draining connections or shipping logs before termination, joining a domain at boot, an instance stuck in Pending:Wait or Terminating:Wait, or AWS::AutoScaling::AutoScalingGroup UpdatePolicy in CloudFormation.
---

# Auto Scaling and Lifecycle Hooks

Scale horizontally across at least two Availability Zones, behind a load balancer, with instances that are disposable and identical (built from one launch template version). Pick the simplest policy that matches the demand pattern, size the group so the loss of one AZ still leaves enough capacity, and add lifecycle hooks only for work that must happen at launch or before termination. Capacity changes affect cost and availability in production: confirm account, region and environment, and get approval before changing a production group's limits, policies or launch template.

## Group fundamentals

- **Min / max / desired.** Min is the floor across all AZs, max is a hard ceiling no policy can exceed, desired is what the group converges to. If scaling stalls under load, check whether desired already equals max before tuning metrics.
- **Launch template**, not launch configuration. Templates are versioned; point production at an explicit version (or `$Default`, promoted deliberately) rather than `$Latest`, so an unreviewed edit does not reach new instances.
- **Subnets in several AZs.** The group rebalances across AZs. To survive one AZ failing when Auto Scaling cannot launch elsewhere, run enough steady-state capacity in the remaining AZs (with three AZs, each must carry about 50% of peak).
- **Health checks.** EC2 status checks are always on. Set `--health-check-type ELB` when behind a load balancer so instances that fail the target group check are replaced. Set the grace period (or, better, default instance warmup) to how long boot plus app start really takes; too short replaces healthy instances that are still starting.
- **ELB integration.** Attach target groups to the group: new instances register automatically, and terminating instances are deregistered with connection draining (target group deregistration delay) first.

Current note: launch configurations are deprecated; AWS no longer adds new instance types to them and new accounts cannot create them. Copy existing ones to launch templates (console "Copy to launch template" or recreate in IaC).

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-prod \
  --launch-template LaunchTemplateName=web,Version=7 \
  --min-size 3 --max-size 12 --desired-capacity 3 \
  --vpc-zone-identifier "subnet-0a1,subnet-0b2,subnet-0c3" \
  --target-group-arns arn:aws:elasticloadbalancing:eu-west-1:111122223333:targetgroup/web/abc123 \
  --health-check-type ELB --default-instance-warmup 120
```

## Choose a scaling approach

| Demand pattern | Use |
|---|---|
| Fixed fleet, self-healing only | min = max = desired |
| Known calendar (business hours, a sale, a TV spot) | Scheduled actions, raising desired and max ahead of time |
| Load tracks a metric | Target tracking (default choice) |
| Need different jumps for different breach sizes | Step scaling with CloudWatch alarms |
| Recurring daily or weekly cycles, slow-starting instances | Predictive scaling, alongside target tracking |

- **Target tracking** keeps a metric near a value (`ASGAverageCPUUtilization`, `ALBRequestCountPerTarget`, or a custom metric). It creates and owns its alarms; do not edit them by hand.
- **Pick a metric that rises with load and falls when capacity is added.** Request count per target or queue depth per instance often beats CPU. Network-in or a metric that does not respond to capacity causes runaway scaling.
- **Scale out fast, scale in slowly.** Add several instances per step; remove one at a time. Target tracking scales in conservatively by design; for step policies, use a longer evaluation period on the scale-in alarm.
- **Flapping** (scale out and in many times an hour): lengthen the scale-in alarm period, set instance warmup / cooldown to real boot time, and check that the scale-out and scale-in thresholds are not too close.
- **Predictive scaling** needs history (at least a day, better two weeks). Start it in forecast-only mode and compare with actual load before switching to forecast-and-scale.

```bash
aws autoscaling put-scaling-policy --auto-scaling-group-name web-prod \
  --policy-name rps-per-target --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/web/0123456789abcdef/targetgroup/web/abc123"},
    "TargetValue": 800}'

aws autoscaling put-scheduled-update-group-action --auto-scaling-group-name web-prod \
  --scheduled-action-name weekday-morning --recurrence "0 7 * * MON-FRI" \
  --time-zone "Europe/Lisbon" --min-size 6 --desired-capacity 6
```

## Scale-in control

- **Termination policy** decides which instance goes first: `Default` (balance AZs, then oldest launch template, then closest to billing hour), `OldestInstance`, `NewestInstance`, `OldestLaunchTemplate`, `AllocationStrategy`. Use `OldestLaunchTemplate` to retire old versions during scale-in.
- **Scale-in protection** (`set-instance-protection`) keeps instances doing long jobs; the job should remove protection when done, or the group can never shrink.
- **Standby** (`enter-standby` / `exit-standby`) takes an instance out of service for debugging without it being replaced.
- **Suspend processes** (`suspend-processes --scaling-processes ReplaceUnhealthy AZRebalance`) during manual investigation or maintenance; record what you suspended and resume it afterwards. A forgotten suspension silently disables self-healing.

## Rolling out a new version

- Prefer immutable replacement: new launch template version, then **instance refresh** with a minimum healthy percentage, warmup and automatic rollback, or a blue/green swap of whole groups for risky changes.
- In CloudFormation, an `UpdatePolicy` (`AutoScalingRollingUpdate` or `AutoScalingReplacingUpdate`) controls how template changes replace instances; preview with a change set first.

```bash
aws autoscaling start-instance-refresh --auto-scaling-group-name web-prod \
  --desired-configuration '{"LaunchTemplate":{"LaunchTemplateName":"web","Version":"8"}}' \
  --preferences '{"MinHealthyPercentage":90,"InstanceWarmup":120,"AutoRollback":true}'
aws autoscaling describe-instance-refreshes --auto-scaling-group-name web-prod
```

- **Warm pools** keep pre-initialised stopped (or hibernated) instances to cut scale-out time for slow-booting apps.
- **Mixed instances policy** with Spot: list several instance types, use the `price-capacity-optimized` allocation strategy, keep an On-Demand base for the critical floor, and enable Capacity Rebalancing. Handle the two-minute interruption notice.

## Lifecycle hooks

The lifecycle: launch, `Pending` (optional `Pending:Wait` hook), `InService`, then on scale-in or health failure `Terminating` (optional `Terminating:Wait` hook), `Terminated`. A hook pauses the instance until your code calls `complete-lifecycle-action` or the heartbeat timeout expires and the default result applies.

Typical uses: launch, join a directory domain, pull config, warm caches, register with a service outside ELB; terminate, flush logs and buffers to S3, finish in-flight jobs, deregister from external systems, snapshot data.

```bash
aws autoscaling put-lifecycle-hook --auto-scaling-group-name web-prod \
  --lifecycle-hook-name flush-logs \
  --lifecycle-transition autoscaling:EC2_INSTANCE_TERMINATING \
  --heartbeat-timeout 300 --default-result CONTINUE

# from the handler (Lambda via EventBridge, or a script on the instance):
aws autoscaling complete-lifecycle-action --auto-scaling-group-name web-prod \
  --lifecycle-hook-name flush-logs --instance-id i-0abc123 \
  --lifecycle-action-result CONTINUE
```

- Route the hook event through EventBridge (`source: aws.autoscaling`, `detail-type: EC2 Instance-terminate Lifecycle Action`) to Lambda, SSM Automation or SQS.
- On launch hooks, `ABANDON` terminates the instance; use it when bootstrap fails rather than letting a broken instance go `InService`.
- Long work: send `record-lifecycle-action-heartbeat` to extend; there is an overall cap, so keep hook work short and idempotent.
- Instances in wait states count against max capacity, so slow hooks reduce elasticity exactly when you need it.
- The handler's IAM role needs only `autoscaling:CompleteLifecycleAction` on that group plus what the task requires; never pass secrets in hook metadata, read them from Secrets Manager or Parameter Store.

## Workflow
1. Confirm account, region, environment and the group's current min/max/desired, policies and launch template version; save them for rollback.
2. Measure boot-to-healthy time and choose health check type, grace period or default instance warmup accordingly.
3. Choose the scaling approach from the demand pattern and a metric that responds to capacity; size for losing one AZ.
4. Define the group, policies and hooks in IaC (CloudFormation, CDK, Terraform); review the change set or plan and get approval for production.
5. Roll out with instance refresh (with auto rollback) or blue/green; watch target health, alarms and scaling activity (`describe-scaling-activities`).
6. Load test or replay traffic in staging to confirm scale-out, scale-in and hook behaviour, including a hook timeout.
7. Alarm on group at max, failed launches, unhealthy host count and hook failures.

## Red flags
- Single-AZ group, or capacity that cannot absorb losing one AZ.
- Production pinned to `$Latest`, or still on launch configurations.
- EC2 health checks only behind a load balancer; app-dead instances stay in service.
- Grace period shorter than boot time; healthy instances replaced in a loop.
- Scaling on a metric unrelated to load, or thresholds that make the group flap.
- Suspended `ReplaceUnhealthy` or `Terminate` processes nobody resumed.
- Lifecycle hook scripts that run for many minutes or are not idempotent.
- Manual edits to a group managed by CloudFormation or Terraform (drift).
- Credentials baked into user data or AMIs.

## Related
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — alarms, custom metrics and EventBridge rules that drive policies and hooks.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — agent metrics and logs used for scaling decisions.
- `../../Delivery/BlueGreenDeployments/blueGreenDeployments.md` — swapping whole groups instead of in-place refresh.
- `../../Delivery/CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — CodeDeploy deployments to ASGs.
- `../../Delivery/CloudFormation/cloudFormation.md` — UpdatePolicy, change sets, drift detection.
- `../../Fundamentals/WellArchitectedPillars/wellArchitectedPillars.md` — reliability and cost trade-offs behind sizing.
- `../SystemsManagerAndConfig/systemsManagerAndConfig.md` — Automation runbooks as hook handlers.
- `../../../Practices/AdvancedTopics/advancedTopics.md` — platform-neutral scaling and resilience practice; AWS syntax does not carry over to Azure VM Scale Sets.
- `../../../Azure/VirtualMachines/virtualMachines.md` — Azure counterpart; not interchangeable.
- `../../../../DataSystems/Foundations/ReliableScalableMaintainable/reliableScalableMaintainable.md` — load parameters and scaling approaches (when installed).
- `../../../../CleanCode/Systems/systems.md` — separating startup from runtime (when installed).
