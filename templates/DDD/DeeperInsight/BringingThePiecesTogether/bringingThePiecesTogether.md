---
name: ddd-bringing-the-pieces-together
description: "The overall process of refactoring toward deeper insight: how it starts (code awkwardness, a vocabulary gap with domain experts, requirements that do not fit, new learning), small short-lived exploration teams with a domain expert, drawing on prior art (domain literature, analysis patterns, design patterns, formalisms), designing for the developers who change the code, when to refactor and when not to, and treating a model crisis as a breakthrough opportunity, based on Chapter 13 (Bringing the Pieces Together) of Domain-Driven Design. Use when deciding whether a model-level refactoring is worth doing now, a new requirement does not fit the current model, tidy code still feels wrong to domain experts, planning a modeling session or spike, someone asks for a full cost justification before refactoring, a release is close, or the team suddenly realizes the model is wrong."
---

# Bringing the Pieces Together

Refactoring toward deeper insight is broader than micro-refactoring at the keyboard: it starts whenever the model stops matching the team's understanding, proceeds through short focused exploration with domain experts and prior art, and lands as small, verified code changes. Bias toward doing it early, but only for changes that sharpen the core domain and that a domain expert would actually use.

## How it starts

Refactor toward deeper insight when any of these appear, even if the code looks clean:

- **Code awkwardness** whose root is in the model: a missing concept, a wrong relationship, a class doing two domain jobs. Standard transformations (extract method, rename) do not remove it.
- **Language gap:** developers' terms differ from what domain experts say, or experts cannot follow a walkthrough of the model.
- **Requirements that do not fit:** each new feature needs special cases, flags or "except when" branches.
- **New learning:** someone now understands the domain better and sees a clearer model.

Spotting the trouble is usually the hardest part. Once named, the search for a better model can be systematic.

## Exploration teams

Small changes take an hour at the keyboard. Larger ones deserve a short, self-organized exploration:

- Two to five people: the initiator(s), someone strong in modeling or in that area of code, and a domain expert whenever the subject is subtle.
- Brainstorm for 30 to 90 minutes: sketch, walk concrete scenarios through candidate objects, check the expert finds the model useful.
- Sleep on it; reconvene once or twice over a few days. If nothing converges, the scope is too big: pick a smaller piece.
- Disband when done. No standing committee is needed.
- Output is a refined UBIQUITOUS LANGUAGE plus a model sketch the original developers formalize in code and tests.

For an agent working alone: simulate the session by writing two or three candidate models in `DomainModel.md`, walking each through the same concrete scenarios from the spec, and asking the engineer (as domain proxy) to choose or correct before coding.

Current note: Event Storming is a widely used format for this kind of session; a scoped "design-level" session fits the half-day-or-less spirit described here.

## Prior art

Do not invent everything. Feed the knowledge crunching with:

- **Domain literature:** how practitioners already organize the concepts (accounting texts, clinical guidelines, logistics handbooks). Results feel familiar to experts.
- **Analysis patterns:** model fragments with software implementation experience behind them. Leads, not recipes.
- **Design patterns** that fit both a code need and a model concept (STRATEGY as policy, COMPOSITE for real part-whole structures).
- **Formalisms:** when arithmetic, set logic, predicate logic, intervals or units fit part of the domain, factor that part out and follow the formal rules. Tight, well-understood models result.

```ts
// A formalism adopted instead of ad hoc date checks: closed-open intervals with algebra.
class Period {
  private constructor(readonly start: Date, readonly end: Date) {}
  static of(start: Date, end: Date) {
    if (end <= start) throw new Error("period must have positive length");
    return new Period(start, end);
  }
  overlaps(o: Period) { return this.start < o.end && o.start < this.end; }
  contains(d: Date) { return this.start <= d && d < this.end; }
  intersect(o: Period): Period | null {
    const s = new Date(Math.max(+this.start, +o.start)), e = new Date(Math.min(+this.end, +o.end));
    return s < e ? Period.of(s, e) : null;
  }
}
// Booking rules now read as interval statements: "a room booking may not overlap another booking".
```

## A design for developers

The code's other users are the developers who change it repeatedly. Deeper models and supple design reinforce each other:

- Intent is visible from names and interfaces; the effect of running or changing code is predictable.
- Dependencies and side effects are minimized so a developer can hold one part in mind at a time.
- Granularity is fine only where the domain is most critical and changes most; elsewhere keep it simple.

## Timing: when to refactor

Waiting for a complete cost justification means waiting too long: the awkward design is already costing you, and it gets more embedded every week. Benefits of a model change cannot be calculated precisely, so demanding that precision kills refactoring or drives it underground.

Refactor when:

- the design no longer expresses the team's current understanding of the domain;
- an important concept is implicit and you see how to make it explicit;
- you see a chance to make an important part of the design suppler.

Do not:

- refactor the model the day before a release;
- introduce "supple" structures that show off technique without addressing the core domain;
- introduce a "deeper model" you could not convince a domain expert to use.

Practically: keep model refactorings small and test-protected, land them behind the existing interfaces where possible, and update the glossary and `DomainModel.md` in the same change.

## Crisis as opportunity

Progress is not steady. Long stretches of small refinements are punctuated by sudden insight that makes the old model look plainly wrong: a gap it cannot express, an opaque area, a statement experts reject. That feels like a crisis; it actually means the team now understands more. Treat it as the start of a breakthrough: stop piling on workarounds, run an exploration, and plan the transition in steps. Then return to steady refinement.

## Workflow

1. Notice a trigger (awkward code, language gap, misfitting requirement, new learning) and write it down in one sentence.
2. Size it: a keyboard-sized change goes straight to tests and code; a larger one gets an exploration.
3. Explore: gather the right two to five people (or candidate models plus the engineer as expert), walk scenarios, consult prior art, timebox and sleep on it.
4. Decide using the "refactor when" and "do not" lists; check release timing.
5. Update the glossary and `DomainModel.md`, then hand to `bdd` (if scenarios' language changes) and `dev`/`tdd` for incremental implementation.
6. After landing, watch for the next trigger; expect occasional breakthroughs, not only steady change.

## Red flags

- "We will clean up the model after the deadline", repeated each sprint.
- Every refactoring proposal blocked pending an ROI estimate.
- Model debates that run for weeks without a smaller scope being chosen.
- Model changes made without any domain expert or engineer review.
- Elegant abstractions experts do not recognize or want.
- Large model rewrites started just before a release.
- Treating the discovery that the model is wrong as a failure to hide rather than a step forward.

## Related

- `../../../actions/ddd.md` — workflow that owns `DomainModel.md` and the glossary.
- `../../../actions/dev.md` — incremental implementation of the refined model.
- `../../../actions/tdd.md` — tests that make model refactoring safe.
- `../../../actions/review.md` — checking code still matches the model.
- `../Breakthrough/breakthrough.md` — what a breakthrough looks like and how to handle it.
- `../ImplicitConcepts/implicitConcepts.md` — finding the missing concepts.
- `../SuppleDesign/suppleDesign.md` — designs that are easy to change.
- `../AnalysisPatterns/analysisPatterns.md` — prior art from analysis patterns.
- `../DesignPatternsInTheModel/designPatternsInTheModel.md` — design patterns as domain patterns.
- `../../ModelInPractice/CrunchingKnowledge/crunchingKnowledge.md` — knowledge crunching with experts.
- `../../ModelInPractice/UbiquitousLanguage/ubiquitousLanguage.md` — refining the language.
- `../../../TDD/Patterns/Refactoring/refactoring.md` — micro-refactoring mechanics (when installed).
- `../../../CleanCode/LegacyRefactoring/legacyRefactoring.md` — refactoring existing code safely (when installed).
