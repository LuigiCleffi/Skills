---
name: aws-lambda-deployments
description: How to package, version, release and operate AWS Lambda functions and orchestrate them with Step Functions (synchronous vs asynchronous invocation, retries, destinations and dead-letter queues, triggers vs event source mappings for SQS, Kinesis, DynamoDB Streams, MSK and Amazon MQ, handler and context, runtimes and deprecation, quotas for memory, timeout, /tmp, environment variables and concurrency, zip packages vs container images, layers, versions, qualified and unqualified ARNs, aliases and weighted aliases, SAM AutoPublishAlias with CodeDeploy canary and linear traffic shifting, execution roles and resource policies, CloudWatch metrics, X-Ray and Lambda Insights, Amazon States Language Task, Choice, Parallel, Map, Wait, Pass, Succeed and Fail states), based on Chapter 12 (Lambda Deployments and Versioning) of AWS Certified DevOps Engineer - Professional. Use when the user runs aws lambda publish-version, create-alias, update-alias, update-function-code or invoke, writes a SAM template with DeploymentPreference or AutoPublishAlias, builds a deployment zip or layer, hits Task timed out, Runtime.ImportModuleError, TooManyRequestsException or throttling, Rate Exceeded, growing IteratorAge, an SQS batch reprocessed forever, a deprecated runtime warning, a function pointing at $LATEST in production, or designs a state machine, retries and catches, or a workflow that waits on a slow external call.
---

# Lambda Deployments and Versioning

Release Lambda code as immutable published versions behind an alias, and move the alias gradually with automatic rollback on alarms; never wire production callers to `$LATEST`. Choose the invocation model first (synchronous, asynchronous, or event source mapping) because retries, error handling and scaling all follow from it. Function updates take effect immediately for every caller of that version or alias, so confirm account, region, function and alias before running any update.

## Invocation models

| Model | Who retries | Failure handling | Examples |
|---|---|---|---|
| Synchronous | The caller | Error returned to caller | API Gateway, ALB, `aws lambda invoke`, SDK calls |
| Asynchronous | Lambda: 2 retries with backoff, events kept up to 6 h by default | On-failure destination (SQS, SNS, Lambda, EventBridge, S3) or DLQ; tune `MaximumRetryAttempts`, `MaximumEventAgeInSeconds` | S3 notifications, SNS, EventBridge |
| Event source mapping (poller) | Lambda polls and retries per batch | SQS: message returns after visibility timeout, then to the queue's DLQ; streams: retry until success or record expiry unless you set `MaximumRetryAttempts`, `BisectBatchOnFunctionError`, on-failure destination | SQS, Kinesis, DynamoDB Streams, MSK/Kafka, Amazon MQ |

- Make handlers idempotent: every model can deliver the same event more than once.
- For SQS and streams, return partial batch failures (`FunctionResponseTypes: [ReportBatchItemFailures]`) so one bad record does not reprocess or block the whole batch.
- Set the SQS visibility timeout to at least six times the function timeout.
- A function triggered by S3 that writes back to the same bucket or prefix can loop and run up cost; write to a different bucket or prefix.

## Quotas and sizing

Current note: the book's limits are outdated. Today: memory 128 MB to 10,240 MB (CPU scales with memory), timeout up to 900 s, `/tmp` 512 MB by default and configurable up to 10,240 MB, environment variables 4 KB total, default concurrency 1,000 per account per region shared by all functions (not per function), zip packages 50 MB zipped for direct upload and 250 MB unzipped including layers, container images up to 10 GB. Check Service Quotas for the account before relying on any number.

- Use reserved concurrency to protect downstream systems (and to cap a function), provisioned concurrency to remove cold starts on latency-sensitive aliases.
- Measure memory against cost and duration rather than guessing; more memory often makes a function cheaper by finishing sooner.
- Over-15-minute or steady high-throughput work belongs in ECS/Fargate, Batch or Step Functions, not one function.

## Packaging

- Build dependencies for the Lambda OS and architecture, not your laptop: for Python, `pip install --platform manylinux2014_x86_64 --only-binary=:all: --target package -r requirements.txt` (use `aarch64` for arm64), or build in the SAM build container (`sam build --use-container`).
- Pin dependency versions; bundle your own SDK version if you depend on specific API behavior.
- Layers share libraries across functions (up to 5 per function); version them and pin each function to a layer version ARN. A layer update does not change functions until they are redeployed with the new ARN.
- Container images suit large dependencies or a standard build toolchain; use AWS base images or implement the Runtime Interface Client.
- Runtimes are deprecated on a published schedule (for example Python 3.8, used in the book, is deprecated). Track deprecation notices and upgrade before create and update are blocked.

## Execution role and invoke permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

- Service principals are lowercase (`lambda.amazonaws.com`).
- Start from `AWSLambdaBasicExecutionRole` (logs only) and add actions on specific resource ARNs; add `AWSLambdaVPCAccessExecutionRole` only for VPC functions and `AWSXRayDaemonWriteAccess` for tracing.
- Who may invoke is a resource-based policy: `aws lambda add-permission` with `--source-arn` and `--source-account` so another account's bucket or rule cannot call your function.
- Secrets go in Secrets Manager or Parameter Store, fetched at init and cached (the Parameters and Secrets Lambda Extension helps); environment variables are visible to anyone with `lambda:GetFunctionConfiguration`.

## Versions and aliases

- `$LATEST` is mutable. `publish-version` snapshots code, runtime, memory, timeout, role, VPC and environment variables as a numbered version with a qualified ARN (`...:function:orders:7`). The unqualified ARN invokes `$LATEST`.
- An alias (`prod`, `staging`) is a named pointer to a version and can split traffic between two versions with weights. Give callers, event sources and permissions the alias ARN.

```bash
aws lambda update-function-code --function-name orders --zip-file fileb://orders.zip
aws lambda wait function-updated --function-name orders
VER=$(aws lambda publish-version --function-name orders --description "$GIT_SHA" --query Version --output text)
# manual canary: send 10% of prod to the new version
aws lambda update-alias --function-name orders --name prod \
  --routing-config "AdditionalVersionWeights={$VER=0.1}"
# promote, or roll back by removing the weight
aws lambda update-alias --function-name orders --name prod --function-version "$VER" --routing-config 'AdditionalVersionWeights={}'
```

## Safe releases with SAM and CodeDeploy

```yaml
Transform: AWS::Serverless-2016-10-31
Resources:
  OrdersFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: python3.12
      Handler: app.handler
      CodeUri: src/
      MemorySize: 512
      Timeout: 30
      Tracing: Active
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes      # or Linear10PercentEvery1Minute, AllAtOnce
        Alarms:
          - !Ref OrdersErrorsAlarm
        Hooks:
          PreTraffic: !Ref OrdersPreTrafficCheck
  OrdersErrorsAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      Namespace: AWS/Lambda
      MetricName: Errors
      Dimensions:
        - {Name: FunctionName, Value: !Ref OrdersFunction}
        - {Name: Resource, Value: !Sub "${OrdersFunction}:live"}
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      TreatMissingData: notBreaching
```

- `AutoPublishAlias` publishes a version on each code change and moves the alias through CodeDeploy; a breaching alarm or failing hook rolls the alias back automatically.
- The pre-traffic hook is a Lambda that tests the new version and reports with `codedeploy:PutLifecycleEventHookExecutionStatus`.
- Review `sam deploy --no-execute-changeset` output (the change set) before executing in production.
- Only code and configuration roll back; data written by the new version and schema changes do not.

## Observability

- Watch `Errors`, `Throttles`, `Duration` (p99 near timeout), `ConcurrentExecutions`, `IteratorAge` (streams falling behind), `AsyncEventAge` and `DestinationDeliveryFailures`/`DeadLetterErrors`.
- Use JSON structured logs with a log level (Lambda's log format setting) and set CloudWatch Logs retention; never log event payloads containing personal data or tokens.
- Enable X-Ray active tracing for latency breakdown and Lambda Insights for memory/CPU per invocation.

## Orchestrating with Step Functions

- Use a state machine when a process has several steps, branches, retries, waits or human approval; keep each Lambda single-purpose.
- States: `Task` (do work: Lambda or a direct service integration), `Choice` (always give a `Default`), `Parallel`, `Map` (per-item fan-out), `Wait`, `Pass`, `Succeed`, `Fail` (set `Error` and `Cause`).
- Put `Retry` (with `BackoffRate`, `MaxAttempts`) and `Catch` on Task states rather than retrying inside functions.
- Prefer direct service integrations (DynamoDB, SQS, SNS, ECS, Batch, any SDK API) over Lambda glue, and `.waitForTaskToken` or `Wait` instead of a Lambda that sleeps on a slow external call.
- Standard workflows: long-running (up to a year), exactly-once, auditable. Express: high-volume, short (5 minutes), at-least-once, cheaper.

Current note: S3 events can start a state machine directly through EventBridge (enable EventBridge notifications on the bucket); no relay Lambda is needed. State machine definitions can be written in YAML in CloudFormation/SAM (`Definition`, or `DefinitionUri` to a file), and JSONata is available as an alternative to JSONPath for data transformation.

```yaml
# CloudFormation Definition (YAML); ${ValidateFnArn} comes from DefinitionSubstitutions
StartAt: Validate
States:
  Validate:
    Type: Task
    Resource: arn:aws:states:::lambda:invoke
    Parameters: {FunctionName: "${ValidateFnArn}:live", Payload.$: "$"}
    Retry: [{ErrorEquals: [Lambda.TooManyRequestsException], IntervalSeconds: 2, MaxAttempts: 4, BackoffRate: 2}]
    Catch: [{ErrorEquals: [States.ALL], Next: Rejected}]
    Next: Done
  Rejected: {Type: Fail, Error: ValidationFailed, Cause: "Order failed validation"}
  Done: {Type: Succeed}
```

## Workflow
1. Confirm account, region, function name and target alias; identify the invocation model and its retry behavior.
2. Build reproducibly for the right architecture; run unit tests and a local or staging invoke.
3. Keep secrets out of code and environment variables; scope the execution role and invoke permissions.
4. Define the function, alias, alarms and deployment preference as code (SAM, CloudFormation, CDK or Terraform).
5. Show the change set or plan; get explicit approval for production.
6. Deploy with canary or linear shifting; watch errors, throttles and duration during the bake time.
7. Roll back by moving the alias to the previous version if alarms fire; record the released version and Git SHA.

## Red flags
- Event sources, API integrations or other accounts pointing at `$LATEST` or the unqualified ARN in production.
- `AllAtOnce` releases with no alarms on a customer-facing function.
- Non-idempotent handlers behind async or queue triggers; no DLQ or on-failure destination.
- SQS batches without partial batch responses; visibility timeout shorter than the function timeout.
- Credentials in environment variables, code or logs; `"Action": "*"` in an execution role.
- Lambda waiting on slow third-party calls or polling loops instead of a Step Functions wait or callback.
- Deprecated runtimes, unpinned layers, packages built on macOS with native extensions.
- One function's runaway concurrency starving others because nothing is reserved or capped.

## Related
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — CodeDeploy deployment configs and pipelines for Lambda.
- `../CloudFormation/cloudFormation.md` — change sets and SAM transforms.
- `../BlueGreenDeployments/blueGreenDeployments.md` — weighted alias shifting as a blue/green variant.
- `../ElasticBeanstalk/elasticBeanstalk.md` — managed platform alternative for long-running web apps.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — alarms, logs and X-Ray traces.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — event-driven triggers.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — execution roles, resource policies, secrets.
- `../../Fundamentals/DynamoDb/dynamoDb.md` — DynamoDB Streams as an event source.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral pipeline practice; not Lambda syntax.
- `../../../../DataSystems/DerivedData/StreamProcessing/streamProcessing.md` (when installed) — stream semantics behind Kinesis and DynamoDB Streams consumers.
- `../../../../CleanCode/ErrorHandling/errorHandling.md` (when installed) — error handling inside handlers.
- `../../../../actions/tdd.md` (when installed) — test-first handler development.
