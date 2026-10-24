---
name: ddd-model-driven-design
description: "How to bind the domain model and the implementation into one: MODEL-DRIVEN DESIGN (a single model that serves both analysis and design, mapped literally into code), why separate analysis models and model-free code both fail, choosing a modeling paradigm the language supports (objects, logic rules) versus procedural scripts that only infer concepts, refactoring a mechanistic script into explicit domain objects, letting the model show through the user interface instead of superimposing a different user model, and HANDS-ON MODELERS (whoever shapes the model touches the code, whoever codes is a modeler), based on Chapter 3 (Binding Model and Implementation) of Domain-Driven Design. Use when the code does not resemble the domain model or the spec diagrams, an analysis model or architecture diagram was produced separately from the code, class names match the model but behavior lives in procedural scripts or services, a concept experts use (bundle, group, tier, wave) exists only as naming conventions or string matching, implementation discoveries are not fed back into the model, the UI exposes a different model from the one underneath and users get surprised, an architect designs the model but does not code, or the user mentions model-driven design, code mirrors the model, analysis model, ivory-tower architect, or mapping model to code."
---

# Binding Model and Implementation

Keep exactly one model, and design the domain part of the code to mirror it literally: every domain object plays a role named in the model, and every important model concept has an obvious home in code. When the model is impractical to implement, change the model; when the code drifts from the model, change the code. Modeling and coding are one loop, done by the same people.

## Why the split fails

| Situation | Result |
|---|---|
| Analysts build an "analysis model" independent of design | Developers cannot implement it (tangled associations, no transactional units), so they write an ad hoc design that borrows a few names; the model is abandoned and its knowledge lost |
| No model at all, function after function | Software works but explains nothing; complexity swamps it |
| A model exists but the code is loosely mapped to it | The model becomes irrelevant, then misleading; its correctness says nothing about the software |

Pure analysis models also fail at their own goal, because many crucial discoveries happen only while implementing.

## MODEL-DRIVEN DESIGN

- Demand a single model that works both as an expression of domain knowledge and as a practical design. There are always many ways to abstract a domain; pick one that satisfies both.
- Map it literally: same names, same responsibilities, same associations (pared down to what the design needs). A reader should be able to go from a sentence in the ubiquitous language to the code without a translation table.
- If implementation forces a new concept or a renamed one, that is a model change: bring it back to the model discussion and the glossary.
- Design elements broken along conceptual lines give natural seams for refactoring and testing.
- This applies to the domain portion of the system. Purely technical code (serialization, transport, caching) need not appear in the model.

## Paradigm and tool support

- The correspondence must be exact within human error, which needs a language whose constructs can directly represent the model's constructs.
- Object-oriented languages fit because objects have identity, associations, classes and behavior that can mirror model concepts. The payoff comes when the code expresses the model, not merely when classes organize code.
- Logic languages (rules and facts) also fit a rule-shaped model.
- Purely procedural code tells the machine steps; data structures hold data but not the active parts of the domain, so the result follows anticipated execution paths instead of domain concepts. Mathematical domains are the exception, since functions are the concepts.

## Example: from mechanistic script to explicit model

A retailer prices thousands of SKUs. Merchandisers think in **product families** ("all Trailhead jackets get the winter markdown"), but the pricing system only knows SKUs. Someone wrote a script:

1. Sort the SKU export by code.
2. Find lines whose code starts with the family prefix, e.g. `TRH-`.
3. For each, append a markdown row to the price-rules file.

It works once. Then there are thirty scripts, each re-parsing files, each broken by a new export format, all inferring "family" from string prefixes. The concept the business uses never appears in code.

Model the concept explicitly:

```ts
export abstract class Priceable {
  private readonly rules = new Set<PriceRule>();
  applyRule(rule: PriceRule): void { this.rules.add(rule); }
  appliedRules(): ReadonlySet<PriceRule> { return this.rules; }
}

export class ProductFamily extends Priceable {
  constructor(readonly name: string) { super(); }
}

export class Sku extends Priceable {
  constructor(readonly code: string, private readonly family?: ProductFamily) { super(); }

  override appliedRules(): ReadonlySet<PriceRule> {
    return new Set([...super.appliedRules(), ...(this.family?.appliedRules() ?? [])]);
  }
}
```

Supporting pieces are named by responsibility, outside the core model:

| Element | Responsibility |
|---|---|
| `SkuImport` (service) | Reads an export file, creates `Sku`s |
| `PriceRuleExport` (service) | Writes every SKU's applied rules to the rules file |
| `InferredFamilyFactory` | Groups SKUs into families using today's code-prefix convention |
| `SkuRepository`, `ProductFamilyRepository` | Look up SKUs and families by code or name |

The core rule is now testable without files, and the test does not depend on naming conventions:

```ts
it("applies a family's rule to every SKU in the family", () => {
  const trailhead = new ProductFamily("Trailhead");
  const small = new Sku("TRH-S", trailhead);
  const large = new Sku("TRH-L", trailhead);
  const winter = PriceRule.markdown(Percent.of(20));

  trailhead.applyRule(winter);

  expect(small.appliedRules()).toContain(winter);
  expect(large.appliedRules()).toContain(winter);
});
```

- A UI that lets merchandisers pick a family and a rule, or a legacy file loader, both call the same `family.applyRule(...)`.
- Rule conflicts, precedence and new file formats now extend the model instead of multiplying scripts.
- For one operation, a script may be the pragmatic choice; the model-driven design wins when the operations multiply.
- This shape is reached through several rounds of crunching and refactoring, not in one step.

## Letting the bones show

- Users form a mental model from the UI. If the UI presents a model that differs from the one underneath, the illusion leaks: errors refer to things the user never saw, data is silently changed, operations behave unexpectedly.
- Example: a notes app shows "folders", but implements them as tags. Moving a note to a second folder keeps it in the first; deleting a folder does not delete notes. Either expose tags honestly ("labels") or implement real folders with folder rules. Both give one consistent model; the mismatch is the bug.
- When the domain model reflects what users care about, more of it can be shown directly, giving users predictable behavior and more power.

## HANDS-ON MODELERS

- Software development is all design; separating "designers" from "assemblers" breaks model-driven design.
- A modeler who does not code loses touch with implementation constraints, so models turn impractical, and the subtle intent behind a model is lost in hand-off diagrams. Feedback about performance or awkwardness arrives months late, if ever.
- Developers who do not feel responsible for the model, or do not realize that changing code changes the model, refactor it into a data structure.
- Therefore: anyone shaping the model spends time in the code; anyone changing domain code learns to express the model through it; every developer joins model discussions and talks with domain experts. Specialized roles are fine; separating modeling from implementation is not.
- For an AI agent: when implementing, treat each domain class and method name as a modeling decision; when the code needs a concept the domain model record lacks, update the record and glossary (via the `ddd` workflow) instead of inventing a private name.

## Workflow

1. Read the domain model record (`DomainModel.md`) and glossary for the bounded context before writing domain code.
2. For each model concept the feature touches, locate or create its code element with the same name and responsibility; note any concept that has no home.
3. If a concept is hard to implement as modeled (huge object graphs, no clear transactional unit, bidirectional webs), propose a model change and record it; do not quietly diverge.
4. Keep technical plumbing (import/export, transport, persistence) in separate services and repositories so the core reads like the model.
5. Test the core model in isolation with domain-language test names; end-to-end tests are a supplement, not the only check.
6. Check the UI and API expose concepts consistent with the domain model; flag any superimposed alternative model.
7. When implementation teaches something new, update the model record and glossary in the same change as the code.

## Red flags

- An architecture or analysis diagram nobody can find in the code.
- Classes named after model concepts holding only fields, with the logic in procedural services or scripts.
- Business concepts existing only as naming conventions, prefixes, flags or string matching.
- "The model is right, we just can't implement it that way," followed by an unrelated design.
- New names invented during coding that never reach the glossary.
- UI terms or behavior that contradict the underlying model; silent data changes to fit an implementation detail.
- A designated modeler or architect who never touches code, or developers excluded from model discussions.
- Only end-to-end file-in/file-out tests, because there is no model to unit test.

## Related

- `../CrunchingKnowledge/crunchingKnowledge.md` — producing a model worth implementing.
- `../UbiquitousLanguage/ubiquitousLanguage.md` — the language that ties model, conversation and code.
- `../../BuildingBlocks/IsolatingTheDomain/isolatingTheDomain.md` — isolating the domain layer so it can mirror the model.
- `../../BuildingBlocks/ModelInSoftware/modelInSoftware.md` — entities, value objects and services that express the model.
- `../../BuildingBlocks/DomainObjectLifecycle/domainObjectLifecycle.md` — aggregates, factories and repositories that make the model storable.
- `../../DeeperInsight/SuppleDesign/suppleDesign.md` — making model-driven code pleasant to change.
- `../../../actions/ddd.md` — where model changes are recorded.
- `../../../actions/dev.md` — implementing the model.
- `../../../actions/tdd.md` — test-driving the domain core in isolation.
- `../../../actions/review.md` — checking that code still mirrors the model.
- `../../../CleanCode/ObjectsAndDataStructures/objectsAndDataStructures.md` — objects versus data structures (when installed).
- `../../../CleanCode/Classes/classes.md` — cohesive classes with one responsibility (when installed).
- `../../../TDD/Patterns/TestingPatterns/testingPatterns.md` — small, isolated tests (when installed).
