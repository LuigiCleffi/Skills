---
name: strategy
description: "Review a checked specification against the Marketing knowledge base (Rumelt's Good Strategy Bad Strategy, Dunford's Obviously Awesome, Kotler, Keller and Chernev's Marketing Management, Cialdini's Influence) and recommend the best approach: diagnose the challenge the feature answers, name the best-fit customer and their real alternatives, check the value and positioning, and, when the product is itself a marketing tool, turn the relevant chapters into domain rules, terms, defaults and ethical guardrails. Adds traced STR items to the spec-checklist and writes a strategy brief; never changes product intent on its own and never writes code. Use after spec-checklist and before ddd, bdd, uiux and dev when a feature is customer-facing, affects positioning, pricing, growth or go-to-market, or the product is a marketing, sales, CRM, campaign, analytics or content tool."
---

# strategy — Product and Marketing Strategy Review

## Purpose and ownership

Before the model, scenarios, screens, and code exist, check that the feature is the right bet for the right customer, and that it reflects what the marketing discipline already knows. The knowledge base turns "build what the spec says" into "build the version of it that wins": a sharper target, a clearer reason to choose it, defaults grounded in proven practice, and guardrails against tactics that would hurt users or the brand.

`strategy` owns the **strategy brief** (`StrategyBrief.md`) and the **Strategy Review** section it appends to the `spec-checklist` result. It recommends; the user decides. It does not change product intent, write production code, or write tests.

## Position in the workflow

```text
plan → spec-definition → spec-checklist → strategy → ddd → bdd → uiux → dev
                               ▲              │
                               └──────────────┘  STR items that need a product decision
```

Run `strategy` when the scoped work:

- is a new product, a new customer-facing feature, or a change to pricing, packaging, onboarding, or messaging;
- is aimed at a market, segment, or competitor, or claims a differentiator;
- belongs to a product whose **domain is marketing** (campaigns, email, ads, CRM, segmentation, positioning, pricing, loyalty, analytics, content, sales enablement), where the books are domain knowledge, not just advice.

Skip it for internal chores, infrastructure, refactors, and bug fixes inside an already-decided behavior. In that case `dev` records "Strategy: not applicable" and proceeds.

## Skill boundaries

- `plan`, `spec-definition`: decide **what** and **why**. `strategy` tests that decision against strategy and marketing practice, and sends any change of intent back to them.
- `spec-checklist`: judges whether the requirements are clear and testable. `strategy` judges whether they are the **right** requirements, and adds what the knowledge base shows is missing.
- `ddd`: models the concepts. When the product is a marketing tool, `strategy` hands it the book terms and rules (segment, value theme, point of difference, CLV) to model.
- `bdd`: turns the STR rules into examples and scenarios.
- `uiux`: uses the brief's audience, value themes, and persuasion guardrails for flows and copy.
- `dev`, `tdd`, `review`: implement and check the ready STR items like any other requirement.

Do not copy another skill's full workflow into this skill. Invoke it and use its output.

## Inputs and source of truth

- The approved specification (`SpecifyRequirements.md`) and the product plan.
- The `spec-checklist` result. Review only the scope it marks **Ready**; leave **Needs clarification** items to their owner.
- Customer evidence the user can provide: best customers, win/loss notes, interviews, usage and churn data, competitor deals, pricing history.
- The knowledge base under `Marketing/`, through its `README.md` routers.

Never invent customers, competitors, results, market sizes, or claims. Where evidence is missing, say so and turn it into a question or a labeled assumption. A recommendation built on an assumption is marked as such.

## Reference library

Start at `Marketing/README.md`, then read only the chapter skills that match the question in front of you. Each book's `README.md` lists every chapter with its "Use when".

| Question | Skills |
|---|---|
| What is the real challenge, and is the spec a strategy or a wish list? | `Marketing/GoodStrategyBadStrategy/GoodAndBadStrategy/KernelOfGoodStrategy/kernelOfGoodStrategy.md`, `Marketing/GoodStrategyBadStrategy/GoodAndBadStrategy/BadStrategy/badStrategy.md` |
| Where to concentrate and what to leave out | `Marketing/GoodStrategyBadStrategy/SourcesOfPower/Leverage/leverage.md`, `Marketing/GoodStrategyBadStrategy/SourcesOfPower/Focus/focus.md` |
| Turning the bet into a first, achievable release | `Marketing/GoodStrategyBadStrategy/SourcesOfPower/ProximateObjectives/proximateObjectives.md`, `Marketing/GoodStrategyBadStrategy/SourcesOfPower/ChainLinkSystems/chainLinkSystems.md` |
| Why we win, and whether it lasts | `Marketing/GoodStrategyBadStrategy/SourcesOfPower/Advantage/advantage.md`, `Marketing/GoodStrategyBadStrategy/SourcesOfPower/Dynamics/dynamics.md` |
| Treating the bet as a testable hypothesis | `Marketing/GoodStrategyBadStrategy/ThinkingLikeAStrategist/ScienceOfStrategy/scienceOfStrategy.md`, `Marketing/GoodStrategyBadStrategy/ThinkingLikeAStrategist/KeepingYourHead/keepingYourHead.md` |
| Who the feature is for | `Marketing/ObviouslyAwesome/PositioningProcess/BestCustomers/bestCustomers.md`, `Marketing/ObviouslyAwesome/PositioningProcess/WhoCaresALot/whoCaresALot.md`, `Marketing/MarketingManagement/MarketStrategy/SegmentationAndTargeting/segmentationAndTargeting.md` |
| What customers do instead today | `Marketing/ObviouslyAwesome/PositioningProcess/CompetitiveAlternatives/competitiveAlternatives.md` |
| What is unique and what value it creates | `Marketing/ObviouslyAwesome/PositioningProcess/UniqueAttributes/uniqueAttributes.md`, `Marketing/ObviouslyAwesome/PositioningProcess/ValueThemes/valueThemes.md`, `Marketing/MarketingManagement/MarketStrategy/ValuePropositionAndPositioning/valuePropositionAndPositioning.md` |
| Category and the story sales and marketing tell | `Marketing/ObviouslyAwesome/PositioningProcess/MarketFrameOfReference/marketFrameOfReference.md`, `Marketing/ObviouslyAwesome/PositioningProcess/CapturePositioning/capturePositioning.md` |
| How buyers decide (consumer or B2B) | `Marketing/MarketingManagement/UnderstandingTheMarket/ConsumerMarkets/consumerMarkets.md`, `Marketing/MarketingManagement/UnderstandingTheMarket/BusinessMarkets/businessMarkets.md` |
| Evidence, research, metrics, and forecasts | `Marketing/MarketingManagement/UnderstandingTheMarket/MarketingResearch/marketingResearch.md` |
| New offering, MVP, launch beachhead | `Marketing/MarketingManagement/ManagingGrowth/NewOfferings/newOfferings.md`, `Marketing/MarketingManagement/ManagingGrowth/CompetitiveGrowth/competitiveGrowth.md` |
| Features, tiers, service, brand | `Marketing/MarketingManagement/DesigningValue/Products/products.md`, `Marketing/MarketingManagement/DesigningValue/Services/services.md`, `Marketing/MarketingManagement/DesigningValue/Brands/brands.md` |
| Pricing, packaging, discounts | `Marketing/MarketingManagement/DesigningValue/PricingAndPromotions/pricingAndPromotions.md` |
| Communications, campaigns, sales, channels | The chapters under `Marketing/MarketingManagement/CommunicatingValue/` and `Marketing/MarketingManagement/DeliveringValue/` (pick from `Marketing/MarketingManagement/README.md`) |
| Retention, loyalty, CLV, NPS | `Marketing/MarketingManagement/ManagingGrowth/CustomerLoyalty/customerLoyalty.md` |
| Expansion to other countries | `Marketing/MarketingManagement/ManagingGrowth/GlobalMarkets/globalMarkets.md` |
| Persuasive flows, copy, and their limits | `Marketing/Influence/README.md`, then the principle in play; `Marketing/Influence/InstantInfluence/instantInfluence.md` for an all-principle ethics review |
| Responsible claims, privacy, children, green claims | `Marketing/MarketingManagement/ManagingGrowth/SociallyResponsibleMarketing/sociallyResponsibleMarketing.md` |

### When the product is a marketing tool

Map each capability to the chapter that defines its domain, and read that chapter for terms, rules, inputs, outputs, and failure modes the spec missed. All paths are under `Marketing/`.

| Capability being built | Domain skill |
|---|---|
| Strategy or planning workspace | `GoodStrategyBadStrategy/GoodAndBadStrategy/KernelOfGoodStrategy/kernelOfGoodStrategy.md`, `MarketingManagement/Fundamentals/MarketingPlanning/marketingPlanning.md` |
| Positioning or messaging builder | `ObviouslyAwesome/README.md` (the ten steps and the canvas) |
| Audience, segment, or ICP builder | `MarketingManagement/MarketStrategy/SegmentationAndTargeting/segmentationAndTargeting.md`, `ObviouslyAwesome/PositioningProcess/WhoCaresALot/whoCaresALot.md` |
| Surveys, research, dashboards, attribution | `MarketingManagement/UnderstandingTheMarket/MarketingResearch/marketingResearch.md` |
| Campaign planner, media mix, content calendar | `MarketingManagement/CommunicatingValue/MarketingCommunications/marketingCommunications.md`, `MarketingManagement/CommunicatingValue/IntegratedCampaigns/integratedCampaigns.md` |
| Email, outbound, sales sequences, CRM pipeline | `MarketingManagement/CommunicatingValue/PersonalSellingAndDirectMarketing/personalSellingAndDirectMarketing.md` |
| Pricing pages, plans, coupons, promotions | `MarketingManagement/DesigningValue/PricingAndPromotions/pricingAndPromotions.md` |
| Loyalty, referral, reviews, NPS, churn | `MarketingManagement/ManagingGrowth/CustomerLoyalty/customerLoyalty.md`, `Influence/SocialProof/socialProof.md`, `Influence/Reciprocation/reciprocation.md` |
| Landing pages, copy or ad generation, urgency or social-proof widgets | `Influence/README.md` and the principle each element uses |
| Partner, marketplace, or reseller management | `MarketingManagement/DeliveringValue/DistributionChannels/distributionChannels.md` |

## Workflow

### 1. Confirm scope and evidence

List the requirement and user-story IDs in scope and confirm the checklist marks them **Ready**. Collect the customer evidence that exists, and list what is missing. Classify the work: product strategy only, or product strategy plus marketing-domain knowledge.

### 2. Diagnose

State, in two or three sentences, the challenge this feature answers for the business and for the customer ("what's going on here?"). If the spec only states a goal ("increase engagement", "add AI"), say so: the diagnosis is missing.

### 3. Find the best-fit customer and their alternatives

From the evidence, name who gets the most value, what they would use if this feature did not exist (including spreadsheets, an agency, an intern, or doing nothing), and why those alternatives fall short. Check that the spec's user stories are written for that customer.

### 4. Check value and positioning

List the unique capabilities the feature adds, the value each one enables, and the proof. Check that the feature strengthens the product's chosen position and market frame rather than diluting it. Flag differentiators with no baseline ("easier", "smarter") and features that serve no one in the target.

### 5. Choose the approach

Lay out two or three real options (narrow versus broad target, build versus integrate, premium versus entry tier, assisted versus automated) with the trade-off of each, and recommend one. Apply concentration: say what the recommendation deliberately leaves out. Turn it into a proximate first release with a hypothesis, a success metric, and the result that would prove it wrong.

### 6. Import the domain knowledge

When the product is a marketing tool, read the domain skill for each capability in scope. Extract:

- **Terms** the tool should use as the book defines them, for `ddd`'s glossary.
- **Rules and calculations** (segment attractiveness criteria, break-even, CLV, reach and frequency, positioning canvas fields) the spec omits or gets wrong.
- **Defaults and templates** grounded in practice that users would otherwise invent.
- **Failure modes** the chapter's red flags describe, which the tool should detect or warn about.

### 7. Set the guardrails

For every flow that persuades, prices, collects data, or makes claims, check it against `Marketing/Influence/` and the socially responsible marketing skill. Make honest use a requirement: no fabricated scarcity, countdowns, reviews, user counts, authority, or reference prices; no hidden fees or hard-to-cancel flows; consent for data use; disclosure for endorsements. When the tool generates such elements for its users, require it to use only true inputs and to warn when they are missing.

### 8. Improve the checklist

Append a **Strategy Review** section to the `spec-checklist` result. Each item:

- has a stable ID (`STR-01`, `STR-02`, ...) and a type: **Gap** (missing strategic decision), **Domain rule** (from the knowledge base), **Guardrail** (ethics or compliance), or **Metric** (success measure or experiment);
- is a concrete, testable statement, with an acceptance condition where possible;
- cites its source: the spec or requirement ID it refines and the chapter skill it comes from;
- has a status: **Ready** (consistent with the spec and approved by the user), **Needs clarification** (a product decision), or **Out of scope**.

An item that would change product intent, scope, or a stated requirement is always **Needs clarification** and goes back to `spec-definition` with the question and your recommendation. Never edit the specification's requirements yourself.

### 9. Resolve and hand off

Ask the user the open decisions one at a time, each with a recommendation and its trade-off. Record every answer. Write `StrategyBrief.md` next to `SpecifyRequirements.md` (or where the user asks), then hand off.

## Output format

```markdown
# Strategy Brief: [FEATURE NAME]

**Status:** Draft | Ready | Blocked on Product Decision
**Specification:** [path] — requirements reviewed: FR-01, US-1, ...
**Knowledge base consulted:** [chapter skills read]

## 1. Diagnosis
The challenge in two or three sentences. Evidence, or the assumption it rests on.

## 2. Target Customer and Alternatives
Best-fit customer, what they use today, why it falls short.

## 3. Value and Positioning
| Unique capability | Value it enables | Proof | Strengthens position? |

## 4. Options and Recommendation
Options with trade-offs; the recommended approach; what it leaves out.

## 5. First Release and Hypothesis
Proximate objective, hypothesis, success metric with baseline, disconfirming result.

## 6. Domain Knowledge (marketing tools only)
Terms, rules and calculations, defaults, failure modes — each with its source chapter.

## 7. Guardrails
Persuasion, pricing, privacy, and claims rules the feature must respect.

## 8. Checklist Additions
STR-01 ... (type, statement, acceptance, source, status) — mirrored in the spec-checklist.

## 9. Decisions Log and Open Questions
Decisions with their source (user, evidence, knowledge base).
**Open Questions: None.** (required for Ready)
```

Omit sections that do not apply.

## Worked example

A team specifies an "AI subject-line generator" for an email marketing tool.

- **Diagnosis:** the spec states a goal ("improve open rates with AI") but no challenge. Evidence from churned accounts shows small e-commerce shops send irregularly because writing each campaign takes too long; open rate is not their bottleneck. **Gap STR-01:** confirm whether the target problem is open rate or campaign effort (Needs clarification).
- **Alternatives:** shops write by hand, copy last year's email, or skip the send. The competitor's generator is not the main alternative; skipping the send is (`competitiveAlternatives.md`).
- **Recommendation:** narrow the feature to "draft a complete campaign from a product and an occasion", for shops with fewer than 5,000 subscribers; leave A/B testing for later. First-release hypothesis: drafted campaigns raise sends per month from 1.2 to 2; drop the idea if sends don't move after six weeks.
- **Domain rule STR-02:** each draft states one objective and one call to action, chosen from the communication objectives in `marketingCommunications.md` (Ready).
- **Guardrail STR-03:** generated copy may claim scarcity or a deadline only when the user has entered a real end date or stock level; otherwise the generator omits it and explains why (`scarcity.md`) (Ready).
- **Metric STR-04:** track sends per active shop per month and 30-day retention, against the current baseline (`marketingResearch.md`) (Ready).

## Handoff to ddd, bdd, uiux, and dev

Point to the brief instead of copying it:

- **Brief and checklist:** paths, status, and the STR IDs marked **Ready**.
- **Target and value:** the customer and value themes `bdd` and `uiux` must write for.
- **Terms and rules:** domain terms and calculations for `ddd` to model (marketing tools).
- **Guardrails:** STR guardrail IDs that `bdd` should cover with scenarios and `review` should check.
- **Metric:** what the release must instrument to test its hypothesis.

When later work shows the recommendation was wrong (the evidence changes, the hypothesis fails), return to `strategy` and the user; the brief and the checklist change together.

## Guardrails

- Never change product intent, scope, or requirements on your own; recommend, and send decisions back to `spec-definition` or the plan.
- Never invent evidence, competitors, numbers, or customer quotes; label assumptions.
- Never recommend or design deceptive patterns, fake social proof, fake urgency, or hidden costs, even when asked; offer the honest alternative.
- Do not read the whole knowledge base; read the chapters that answer the question at hand.
- Do not turn the review into a marketing plan for the company; stay on the feature in scope.
- Do not write production code or tests.
- Preserve unrelated user changes in the repository.

## Completion criteria

The strategy review is complete when the feature in scope has a stated diagnosis, target customer, alternatives, and value; the recommended approach and what it excludes are recorded; the first release has a hypothesis and a metric; marketing-domain rules and guardrails are captured where they apply; every STR item is traced to the spec and a chapter skill with a status; the brief says **Open Questions: None.**; and `ddd`, `bdd`, `uiux`, and `dev` have a concise handoff.
