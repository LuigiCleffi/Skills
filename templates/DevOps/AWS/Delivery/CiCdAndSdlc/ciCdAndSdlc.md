---
name: aws-ci-cd-and-sdlc
description: How to design a CI/CD process on AWS across the software delivery stages (source, build, test, deploy, monitor, plan), the difference between continuous integration, continuous delivery and continuous deployment, mapping stages to CodeCommit, CodeBuild, CodeArtifact, CodeDeploy and CodePipeline or to third-party tools (GitHub Actions, Jenkins, GitLab, Artifactory), the test pyramid in a pipeline (unit, integration, performance, SAST/DAST, UI), application, infrastructure and tools/platform team responsibilities, and choosing a deployment strategy (in-place all-at-once, rolling, immutable, blue/green, canary, linear), based on Chapter 6 (Understanding CI/CD and the SDLC) of AWS Certified DevOps Engineer - Professional. Use when the user asks how to set up a pipeline on AWS, whether to automate production releases or keep a manual approval, which deployment strategy to use, how to roll back, where tests belong in the pipeline, how to stop builds failing on npm/pip/Maven download limits, wants a private package registry (codeartifact login), wants GitHub Actions to deploy to AWS without access keys (OIDC, configure-aws-credentials, role-to-assume), or mentions SDLC, CI/CD, continuous delivery vs continuous deployment, DevSecOps, two-pizza teams, Route 53 weighted routing for canaries or traffic shifting.
---

# CI/CD and the SDLC on AWS

Decide three things before touching any service: how far automation goes (integration only, delivery to a releasable artifact with a human gate, or deployment straight to production), which tests must pass at each stage to justify that, and which deployment strategy gives the rollback you need. Then map each stage to a tool the team already runs well; AWS-native services and third-party tools mix freely.

## The stages and what each must produce

| Stage | Output that gates the next stage | AWS-native option | Common alternative |
|---|---|---|---|
| Source | Reviewed commit on a protected branch | CodeCommit | GitHub, GitLab, Bitbucket (via CodeConnections) |
| Build | Versioned, immutable artifact (package, container image) | CodeBuild, CodeArtifact, ECR | GitHub Actions, Jenkins, Artifactory |
| Test | Pass/fail reports, coverage, security findings | CodeBuild (test reports) | Same CI runner, SaaS scanners |
| Deploy | Running version, health checks green | CodeDeploy, CloudFormation, ECS, Elastic Beanstalk | Argo CD, Spinnaker, Terraform |
| Monitor | Alarms, dashboards, deployment markers | CloudWatch, X-Ray | Prometheus/Grafana, Datadog |
| Plan | Prioritized backlog fed by what monitoring showed | — | Issue tracker |

Orchestrate the stages with CodePipeline, GitHub Actions or Jenkins. Build the artifact once and promote the same artifact through every environment; rebuilding per environment means production runs something that was never tested.

## Integration, delivery, deployment

- **Continuous integration**: everyone merges to the mainline at least daily; every push triggers build plus automated tests; a red build is fixed before anything else.
- **Continuous delivery**: every change that passes the pipeline produces a release candidate that *could* go to production; a person decides when (manual approval action, change ticket).
- **Continuous deployment**: no human gate; every change that passes the automated checks goes to production. Only adopt it when test coverage, monitoring and automatic rollback are trustworthy.

Some material, including the source book, uses "CD" loosely for both; always ask which one the team means. Regulated workloads usually keep a manual approval before production even when everything else is automated.

## Tests in the pipeline

Order tests fast to slow so feedback arrives early:

1. **Unit tests** on every push; run locally too. Fail the build on failure.
2. **Integration / component tests** against real dependencies in an ephemeral or test environment (database connectivity, queues, third-party sandboxes).
3. **Security and compliance**: dependency and image scanning, SAST on source, DAST against a running test environment, IaC scanning (cfn-lint, cfn-guard, Checkov). This is the DevSecOps part; block on high-severity findings with a documented exception process.
4. **Performance**: stress tests (many users, short window) to find breaking points; soak tests (steady load for hours or days) to find leaks. Run on a production-sized environment, not on every commit.
5. **UI / end-to-end**: a small set of critical journeys (sign-in, password reset, checkout). Keep manual testing to exploratory work only.

Start small (build plus unit tests plus deploy to test) and add stages as confidence grows. A pipeline without tests only automates the speed at which defects reach users.

## Dependencies and artifacts: CodeArtifact

Use a private registry so builds and scale-out events do not depend on public registries' availability or rate limits, and so only approved package versions are used.

```bash
# Developer or CI step: point npm at the CodeArtifact repository (token lasts up to 12 hours)
aws codeartifact login --tool npm --domain acme --domain-owner 111122223333 --repository shared
# pip and twine work the same way: --tool pip / --tool twine
```

- Create one domain per organization, repositories per team or purpose, with an upstream repository holding an external connection (npmjs, PyPI, Maven Central, NuGet).
- Reach it from private subnets through VPC endpoints (PrivateLink) so builds need no internet path.
- Automate package approval with EventBridge events on package version changes.
- CodeArtifact stores dependencies and published libraries; build outputs for deployment go to S3 or ECR.

## Credentials for pipelines

- Pipelines assume IAM roles; never store long-lived access keys in CI variables, repositories or build logs.
- For GitHub Actions, federate with OIDC and restrict the trust policy to the repository and branch or environment:

```yaml
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production        # protected environment with required reviewers
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::111122223333:role/gha-deploy-prod
          aws-region: eu-west-1
      - run: aws sts get-caller-identity   # confirm the account before deploying
```

The role's trust policy should require `token.actions.githubusercontent.com:aud` = `sts.amazonaws.com` and a `sub` of `repo:org/repo:environment:production`, and its permissions should cover only what the deployment touches.

## Team responsibilities

- **Application teams** own the code, its backlog, its tests and their part of the pipeline definition.
- **Infrastructure team** owns accounts, networking, IAM, identity federation and the IaC modules (CloudFormation, CDK, Terraform) teams build on.
- **Tools / platform team** builds and runs the shared pipeline tooling and templates so application teams self-serve. Calling it "the DevOps team" misses the point: DevOps is shared ownership of delivery and operations, not a tool group.
- Keep teams small enough to own a service end to end. Separate duties where it matters: developers propose changes; merging to protected branches and approving production deployments need a second person.

## Choosing a deployment strategy

Ask: how fast must it be, what does a failure cost users, how fast must rollback be, does it need DNS or load balancer changes, and does it reuse existing instances or create new ones?

| Strategy | How | Rollback | Cost / risk | AWS mechanisms |
|---|---|---|---|---|
| All-at-once (in-place) | Update every instance together | Redeploy old version; downtime likely | Cheapest, riskiest; fine for dev | CodeDeploy AllAtOnce, Beanstalk all at once |
| Rolling | Update batches; each must pass health checks | Roll forward or redeploy batches | Mixed versions run simultaneously | CodeDeploy OneAtATime/HalfAtATime, ASG instance refresh, ECS rolling |
| Immutable | New instances with the new version, then retire old | Terminate new instances | Extra capacity during deploy | Beanstalk immutable, new launch template version |
| Blue/green | Full parallel environment, switch traffic | Switch back | Double capacity during switch; DNS TTLs if using Route 53 | CodeDeploy blue/green, ALB listener swap, Beanstalk CNAME swap |
| Canary | Small share of traffic first, then the rest | Shift traffic back | Needs good metrics to judge the canary | CodeDeploy canary (Lambda, ECS), Route 53 weighted, API Gateway canary |
| Linear | Equal increments at fixed intervals | Shift traffic back | Slower, very observable | CodeDeploy linear (Lambda, ECS), weighted target groups |

- Mixed versions during rolling or canary releases mean API and database changes must be backward compatible with the previous release; sticky sessions reduce but do not remove version flip-flopping for users.
- Prefer load-balancer-level switches over DNS switches; clients and resolvers cache DNS beyond the TTL.
- Wire CloudWatch alarms into the deployment so a bad release stops and rolls back automatically.

## Workflow
1. Write down the release goal: delivery with approval or deployment without it, target environments, and the rollback time the business accepts.
2. Inventory existing tools (repository host, CI, registry) and reuse what works; choose AWS-native services where they remove servers to run.
3. Define the artifact (package or image), how it is versioned, and where it is stored (S3, ECR, CodeArtifact).
4. Lay out stages with the tests that gate each; add security scanning and IaC validation before any deploy stage.
5. Pick the deployment strategy per environment (all-at-once for dev is fine; canary, linear or blue/green with alarms for production).
6. Set up roles: pipeline roles per environment with least privilege, OIDC for external CI, secrets from Secrets Manager or Parameter Store.
7. Confirm account, region and environment, preview infrastructure changes (change sets), and get explicit approval before creating or changing production pipelines or roles.
8. Add notifications (SNS, chat via Amazon Q Developer in chat applications, formerly AWS Chatbot, or a Lambda function) for failures and approvals, and dashboards showing deployment frequency, failure rate and time to restore.

## Red flags
- "CD" used without saying whether production deploys need a human approval.
- Rebuilding the artifact per environment instead of promoting one immutable artifact.
- Access keys stored as CI secrets when OIDC or role assumption is available.
- No automated tests before the deploy stage; manual regression testing as the main gate.
- All-at-once deployments to production with no alarms and no tested rollback.
- Database migrations that break the previous application version during rolling or canary releases.
- Builds pulling straight from public registries at scale-out time.
- One person able to write code, merge it and approve its production deployment unchecked.
- Blue/green switched via DNS with long TTLs, then surprise when traffic keeps hitting blue.

## Related
- `../CodeCommitAndCodeBuild/codeCommitAndCodeBuild.md` — source control, buildspec, test reports.
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — pipeline stages, approvals, appspec, rollbacks.
- `../CloudFormation/cloudFormation.md` — infrastructure stages, change sets, CDK.
- `../BlueGreenDeployments/blueGreenDeployments.md` — blue/green in depth.
- `../LambdaDeployments/lambdaDeployments.md` — aliases, versions and traffic shifting for functions.
- `../ElasticBeanstalk/elasticBeanstalk.md` — managed rolling, immutable and swap deployments.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — roles, OIDC trust policies, Secrets Manager.
- `../../Monitoring/CloudWatchAndXRay/cloudWatchAndXRay.md` — alarms that gate and roll back deployments.
- `../../../Practices/ContinuousIntegration/continuousIntegration.md` — platform-neutral CI practice.
- `../../../Practices/DeliveryPipeline/deliveryPipeline.md` — platform-neutral pipeline design; AWS syntax does not carry over to Azure or other tools.
- `../../../Azure/AppService/appService.md` — Azure counterpart for deployment slots; do not apply AWS syntax there.
- `../../../../actions/dev.md` and `../../../../actions/tdd.md` — development and test-first workflows feeding the pipeline (when installed).
- `../../../../TDD/README.md` — writing the unit tests the build stage runs (when installed).
