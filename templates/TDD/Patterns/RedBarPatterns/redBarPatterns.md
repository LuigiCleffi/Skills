---
name: tdd-red-bar-patterns
description: Patterns for choosing which test to write next, where tests come from, and when to stop writing them, based on Chapter 26 (Red Bar Patterns) of Test-Driven Development: By Example. Use when picking the next test from a to-do list, writing the very first test for a new feature, adopting an unfamiliar library or API, a bug is reported, a discussion drifts off topic, explaining behavior to teammates, or the agent (or user) is tired, stuck or lost in a tangled change.
---

# Red Bar Patterns

These patterns decide when you write a test, where you write it, and when you stop. Pick tests that teach you something and that you can make pass; start from a trivial case; turn questions, libraries and bugs into tests; and when the work goes sideways, step away or start over.

## One Step Test

**Question:** Which test should you pick next from the list? **Answer:** One that will teach you something and that you are confident you can implement.

- Each test should be one step toward the overall goal. Step size is personal: what is one step for a newcomer is a tenth of a step for an expert.
- Scan the list: skip the obvious and the baffling; take the one that is not obvious but doable.
- If no item is one step, add intermediate tests to the list that would make progress toward them.
- Growth is neither top-down nor bottom-up: it goes from known to unknown.

## Starter Test

**Question:** Which test should you start with? **Answer:** A variant of the operation that does nothing.

- A realistic first test forces you to answer at once: where does the operation belong, what are the right inputs, what is the right output. That means a long time without feedback.
- Pick inputs and outputs that are trivial: output equal to input, the smallest input, an empty collection.
- The Starter Test is still a One Step Test: if you have built this many times, choose one that needs an operation or two; if it is hairy and new, choose the smallest courageous step.
- A Starter Test often sits at a higher level, like an application test (open a socket, send "hello", read it back); later tests then work in the details.

```ts
it("reduces an empty mesh to an empty mesh", () => {
  expect(new Reducer([]).result()).toEqual([]);
});
```

## Explanation Test

**Question:** How do you spread the use of automated testing? **Answer:** Ask for and give explanations in terms of tests.

- Do not force TDD on people; zeal stops adoption fast.
- Ask: "So if I have this input and that one, the answer should be 76?" Explain: "Today this gives 76; with these inputs I would like 67."
- At higher levels, offer to turn a sequence diagram into a test case containing all its externally visible objects and values.

## Learning Test

**Question:** When do you write tests for externally produced software? **Answer:** Before the first time you use a new facility of the package.

- Instead of calling the new API in production code and hoping, write a small test that checks the API behaves as you believe. If your understanding is right, it passes the first time.
- Keep these tests. When a new version of the library arrives, run them first; if they fail, the application will too.

```ts
it("map preserves insertion order", () => {
  const m = new Map([["b", 1], ["a", 2]]);
  expect([...m.keys()]).toEqual(["b", "a"]);
});
```

## Another Test

**Question:** How do you keep a technical discussion on track? **Answer:** When a tangential idea comes up, add a test to the list and go back to the topic.

- Respect new ideas, but do not let them pull attention away from the current step. Write them at the end of the list.

## Regression Test

**Question:** What is the first thing you do when a defect is reported? **Answer:** Write the smallest test that fails and that, once it passes, means the defect is fixed.

- A regression test is the one you would have written originally with perfect foresight. Each time, ask how you could have known to write it, and use that lesson in future Test Lists.
- Application-level regression tests let users state concretely what is wrong and what they expected.
- If you cannot isolate the defect easily, refactor first: the defect is the system telling you its design is not finished.

## Break

**Question:** What do you do when you feel tired or stuck? **Answer:** Take a break.

- Distance often releases the missing idea. Take the break anyway, the idea will keep.
- If no idea comes, revisit the session goals: still realistic? impossible? what does that mean for the team?
- The ladder of TDD: know what to type, type the Obvious Implementation; do not know, Fake It; design unclear, Triangulate; still nothing, step away.
- Fatigue erodes the judgment needed to notice fatigue; build in outside cues (hourly, daily, weekly, yearly rest).

## Do Over

**Question:** What do you do when you are lost? **Answer:** Throw away the code and start over.

- When code that was fine an hour ago is a mess and you cannot see how to make the next test pass, restarting is almost always better than untangling.
- In pairs, switching partners is a good trigger: a fresh partner, free of your mistakes, will suggest a cleaner start.
- For an agent: revert to the last green commit and replay the Test List with smaller steps rather than patching a red, tangled state.

## Cheap Desk, Nice Chair

**Question:** What physical setup should you use for TDD? **Answer:** Get a really nice chair; skimp on the rest if needed.

- You cannot program well with a sore back. Arrange the desk so pairs can slide the keyboard and each sits squarely in front of it when driving.
- Put the best machines on shared development work, cheap ones on mail and browsing.

## Workflow

1. Starting a feature: write a Starter Test (empty or identity case).
2. Next test: choose a One Step Test from the list; if none fits, add stepping-stone tests.
3. New library facility: write a Learning Test before using it in code.
4. Bug report: write the smallest failing Regression Test first, then fix; refactor first if it cannot be isolated.
5. Tangents in discussion or code: Another Test on the list, then return.
6. Stuck: Break. Lost and tangled: Do Over from the last green state.

## Red flags

- A first test that requires solving the whole problem.
- Picking only trivial tests (no learning) or impossible ones (long red).
- Production code calling an unfamiliar API with no Learning Test.
- Fixing a reported bug with no failing test written first.
- Chasing every new idea mid-step instead of listing it.
- Pushing on while tired, or patching a tangled change instead of starting over.

## Related

- `../TDDPatterns/tddPatterns.md` — the Test List these patterns pick from.
- `../TestingPatterns/testingPatterns.md` — Child Test when a chosen test proves too big.
- `../GreenBarPatterns/greenBarPatterns.md` — Fake It, Triangulate, Obvious Implementation referenced by Break.
- `../../../CleanCode/Boundaries/boundaries.md` — learning tests for third-party code.
- `../../../CleanCode/UnitTests/unitTests.md` — how each new test should be structured.
