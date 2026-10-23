---
name: aws-codecommit-and-codebuild
description: How to host source in AWS CodeCommit (IAM-based access, git-remote-codecommit, SSH keys and HTTPS Git credentials, cross-account access, protecting the main branch with IAM conditions, pull requests and approval rule templates, notifications) and how to build and test with AWS CodeBuild (build projects, managed images, service roles, buildspec.yml version 0.2 with install, pre_build, build and post_build phases, env variables from Parameter Store and Secrets Manager, artifacts to S3, Docker images to ECR, caching, test and coverage reports, triggers from webhooks, EventBridge or CodePipeline, codebuild-breakpoint debugging with Session Manager), based on Chapter 8 (Creating Workloads with CodeCommit and CodeBuild) of AWS Certified DevOps Engineer - Professional. Use when creating a CodeCommit repository or migrating to or from it, a git clone to git-codecommit fails with 403 or permission denied (publickey), developers can push straight to main, the user wants required approvals on pull requests, writes or debugs a buildspec.yml, a build fails with "Cannot connect to the Docker daemon", "YAML_FILE_ERROR", "CLIENT_ERROR" or AccessDenied on ecr:GetAuthorizationToken, wants builds to start on push, test reports in the console, faster builds via cache, or mentions aws codebuild start-build, create-project, aws codecommit create-approval-rule-template, codebuild-resume or CodeBuild-hosted GitHub Actions runners.
---

# CodeCommit and CodeBuild

Source control and builds are the front door of every deployment, so lock them down first: only reviewed changes reach the main branch, builds run with a narrowly scoped service role, and no secret ever appears in a repository, a buildspec or a build log. Then make builds fast, reproducible and self-reporting.

## Choosing the repository host

Current note: AWS closed CodeCommit to new customers in July 2024; check its current status for the account before choosing it. When the organization already uses GitHub, GitLab or Bitbucket, keep it and connect it to AWS through AWS CodeConnections (formerly CodeStar Connections) or OIDC from that platform's CI.

CodeCommit fits when you want repositories governed entirely by IAM inside AWS accounts: encrypted at rest with KMS and in transit, access through IAM users or roles, events to EventBridge and SNS.

## Access to CodeCommit

| Method | When | Notes |
|---|---|---|
| `git-remote-codecommit` (`codecommit::region://profile@repo`) | Federated users, SSO, roles | Uses temporary credentials; preferred |
| HTTPS Git credentials | IAM users with tools that need a username/password | Generated per IAM user; rotate and revoke |
| SSH public key on the IAM user | IAM users who prefer SSH | Key ID goes in `~/.ssh/config` as `User` |

```bash
pip install git-remote-codecommit
git clone codecommit::eu-west-1://dev-profile@orders-service
```

```
# ~/.ssh/config for the SSH method; one key per purpose, protected with a passphrase
Host git-codecommit.*.amazonaws.com
  User APKAEXAMPLEKEYID
  IdentityFile ~/.ssh/codecommit_orders
```

- Give developers permissions through groups or roles, never by attaching admin policies. The managed `AWSCodeCommitPowerUser` policy allows merging into any branch; restrict it.
- Cross-account access: a role in the repository account that the other account's principals assume; do not create IAM users for outside developers.
- Never create IAM users with passwords typed into scripts or chat; prefer IAM Identity Center. If a console password must be set, let the user set it at first sign-in.

## Protect the main branch

Deny direct pushes and merges to `main` for developers so changes go through pull requests:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": [
      "codecommit:GitPush", "codecommit:DeleteBranch", "codecommit:PutFile",
      "codecommit:MergeBranchesByFastForward", "codecommit:MergeBranchesBySquash",
      "codecommit:MergeBranchesByThreeWay", "codecommit:MergePullRequestByFastForward",
      "codecommit:MergePullRequestBySquash", "codecommit:MergePullRequestByThreeWay"
    ],
    "Resource": "arn:aws:codecommit:eu-west-1:111122223333:orders-service",
    "Condition": {
      "StringEqualsIfExists": { "codecommit:References": ["refs/heads/main"] },
      "Null": { "codecommit:References": "false" }
    }
  }]
}
```

Require reviews with an approval rule template associated with the repositories:

```bash
aws codecommit create-approval-rule-template --approval-rule-template-name main-two-reviewers \
  --approval-rule-template-content '{"Version":"2018-11-08","DestinationReferences":["refs/heads/main"],
  "Statements":[{"Type":"Approvers","NumberOfApprovalsNeeded":2,
  "ApprovalPoolMembers":["arn:aws:sts::111122223333:assumed-role/Reviewers/*"]}]}'
aws codecommit associate-approval-rule-template-with-repository \
  --approval-rule-template-name main-two-reviewers --repository-name orders-service
```

- Pull request flow: feature branch, push, open pull request, automated build posts status, reviewers approve, an authorized principal merges (fast-forward, squash or three-way) and deletes the branch.
- Send repository events (pull request created, merged, comments) to SNS or chat through notification rules.

## CodeBuild projects

CodeBuild runs each build in a fresh, managed container; there are no build servers to patch or scale.

```bash
aws codebuild create-project --name orders-build \
  --source type=CODECOMMIT,location=https://git-codecommit.eu-west-1.amazonaws.com/v1/repos/orders-service \
  --environment type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,privilegedMode=true \
  --artifacts type=S3,location=acme-build-artifacts-eu-west-1,packaging=ZIP \
  --service-role arn:aws:iam::111122223333:role/codebuild-orders \
  --logs-config cloudWatchLogs={status=ENABLED}
```

- Use a current managed image and pin a major version; `privilegedMode=true` is needed only to run Docker builds.
- The service role needs only: read the source, write the artifact bucket and log group, push to the specific ECR repository, read the specific secrets and parameters. Not `AdministratorAccess`.
- Run builds that must reach private resources (databases for integration tests, CodeArtifact endpoints) inside a VPC with private subnets and VPC endpoints.
- Encrypt artifacts with a customer-managed KMS key when they cross accounts.

## buildspec.yml

By default CodeBuild reads `buildspec.yml` at the source root; a project can point to another path or name (for example `buildspec-test.yml`) or carry an inline buildspec.

```yaml
version: 0.2
env:
  variables:
    IMAGE_REPO: 111122223333.dkr.ecr.eu-west-1.amazonaws.com/orders
  parameter-store:
    SONAR_HOST: /ci/sonar/host
  secrets-manager:
    SONAR_TOKEN: ci/sonar:token          # injected at runtime, masked in logs
phases:
  install:
    runtime-versions:
      python: 3.12
    commands:
      - pip install -r requirements-dev.txt
  pre_build:
    commands:
      - aws ecr get-login-password | docker login --username AWS --password-stdin "${IMAGE_REPO%%/*}"
      - TAG=$(echo "$CODEBUILD_RESOLVED_SOURCE_VERSION" | cut -c1-12)
  build:
    commands:
      - pytest --junitxml=reports/junit.xml --cov=src --cov-report=xml:reports/coverage.xml
      - docker build -t "$IMAGE_REPO:$TAG" .
  post_build:
    commands:
      - docker push "$IMAGE_REPO:$TAG"
      - printf '[{"name":"orders","imageUri":"%s"}]' "$IMAGE_REPO:$TAG" > imagedefinitions.json
reports:
  unit-tests:
    files: [junit.xml]
    base-directory: reports
    file-format: JUNITXML
  coverage:
    files: [coverage.xml]
    base-directory: reports
    file-format: COBERTURAXML
artifacts:
  files: [imagedefinitions.json]
cache:
  paths:
    - /root/.cache/pip/**/*
```

- Phases: `install` (toolchains, test frameworks), `pre_build` (logins, dependency fetch), `build` (compile, test, build images), `post_build` (package, push, write deployment descriptors). A failing command fails the phase; `post_build` still runs after a `build` failure, so guard pushes with `CODEBUILD_BUILD_SUCCEEDING`.
- Tag images with the commit SHA, never only `latest`, so deployments are traceable and rollbacks pick an exact image.
- `artifacts` supports `base-directory`, `discard-paths` and secondary artifacts; build outputs go to S3, images to ECR. CodeArtifact supplies dependencies; it does not store build outputs.
- Never `echo` secrets, run `set -x` around them, or write them into artifacts.

## Test reports

- Supported test formats: JUnit XML, NUnit XML, NUnit3 XML, TestNG XML, Visual Studio TRX, Cucumber JSON; coverage formats include Cobertura, JaCoCo, Clover, SimpleCov and lcov.
- A `reports` group named in the buildspec is created on first run. Report data expires after 30 days; export raw results to S3 (with a lifecycle policy) when history must be kept longer.
- Fail the build on test failures; use reports for trend and triage, not as the gate.

## Triggering builds

- GitHub, GitHub Enterprise, Bitbucket and GitLab sources: CodeBuild webhooks with filter groups (event type, branch, file path).
- CodeCommit: an EventBridge rule on `CodeCommit Repository State Change` targeting the project, or a CodePipeline source stage. Current note: the book wires this through Lambda; EventBridge (formerly CloudWatch Events) needs no custom code.
- Pull request builds should report status back to the pull request so reviewers see results before approving.
- CodeBuild can also host GitHub Actions self-hosted runners, giving Actions workflows AWS-managed compute inside your VPC.

## Debugging builds

- Read the phase that failed in the build log (CloudWatch Logs or S3) before changing anything.
- Pause a build interactively: start it with Session Manager enabled and add `codebuild-breakpoint` where it should stop; run `codebuild-resume` in the session to continue.

```bash
aws codebuild start-build --project-name orders-build --debug-session-enabled
```

- Common causes: Docker daemon errors (privileged mode off), `AccessDenied` (service role missing ECR, S3, KMS or secret permissions), `YAML_FILE_ERROR` (indentation or wrong `version`), timeouts (raise the timeout or cache dependencies), network failures in a VPC (missing NAT or VPC endpoints).

## Workflow
1. Confirm account, region and whether repositories, roles and projects are shared or production-critical.
2. Choose the repository host; for CodeCommit, set up access through roles and `git-remote-codecommit`.
3. Protect `main`: deny direct pushes and merges via IAM, attach an approval rule template, enable notifications.
4. Create a least-privilege CodeBuild service role and project from code (CloudFormation, CDK or Terraform), not the console.
5. Write the buildspec: pinned runtimes, tests with reports, image tagged by commit, secrets from Secrets Manager or Parameter Store.
6. Wire triggers (webhook, EventBridge or pipeline) and report status on pull requests.
7. Run a build, check logs and reports, then add caching once it is correct.
8. Present IAM and repository-policy changes for approval before applying them to shared or production accounts.

## Red flags
- Developers able to push or merge directly to `main`; no required approvals.
- Long-lived access keys or Git credentials in buildspecs, environment variables or repositories.
- CodeBuild service role with `*` actions or administrator access.
- Secrets in `env.variables` (plain text in the project) instead of `secrets-manager` or `parameter-store`.
- Images pushed only as `latest`; artifacts that cannot be traced to a commit.
- Privileged mode enabled on projects that do not build containers.
- Builds that pass with failing tests, or test reports nobody exports beyond 30 days when audits need them.
- Initial passwords for IAM users written into scripts, tickets or chat.

## Related
- `../CiCdAndSdlc/ciCdAndSdlc.md` — where source and build sit in the delivery process; OIDC for external CI.
- `../CodeDeployAndCodePipeline/codeDeployAndCodePipeline.md` — orchestrating builds and deployments in a pipeline.
- `../CloudFormation/cloudFormation.md` — defining repositories, projects and roles as code; linting templates in builds.
- `../../Fundamentals/IamAndSecrets/iamAndSecrets.md` — IAM conditions, roles and secret stores.
- `../../Fundamentals/S3Storage/s3Storage.md` — artifact buckets, encryption and lifecycle.
- `../../Monitoring/MetricsAndEventBridge/metricsAndEventBridge.md` — EventBridge rules for repository and build events.
- `../../../Practices/ContinuousIntegration/continuousIntegration.md` — platform-neutral CI practice; buildspec syntax does not apply to Jenkins, GitHub Actions or Azure Pipelines.
- `../../../../actions/review.md` — code review workflow behind pull request approvals (when installed).
- `../../../../TDD/README.md` — producing the unit tests builds run (when installed).
