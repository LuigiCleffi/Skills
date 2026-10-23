---
name: uiux-modeling-diagrams
description: How to choose and write diagrams that pin down UI/UX behavior so dev can build it and tdd can test it, covering UML (use case with include and extend, activity with decisions and swimlanes, sequence with lifelines, activation and alt/opt/loop fragments, state machine with events, guards and actions, class and object, component, package, deployment), timing diagrams for debounce, timeouts and latency, cause-and-effect (Ishikawa, fishbone, 6 Ms) for UX defects, and diagrams as code with Mermaid.js and PlantUML, including accessible text alternatives, based on the Modeling diagrams section of UI/UX Design Guide. Use when specifying a user flow, screen states, loading/empty/error/success states, a multi-step form or wizard, UI-to-API interaction, who does what in a process, navigation between screens, why users fail at a step, or debounce and timeout behavior, or when the user mentions UML, use case diagram, activity diagram, flowchart, swimlane, sequence diagram, state diagram, state machine, statechart, XState, class diagram, ER diagram, component diagram, deployment diagram, timing diagram, fishbone, Ishikawa, root cause, Mermaid, PlantUML, or diagrams as code.
---

# Modeling diagrams

Draw a diagram only to answer a specific question about the UI that prose leaves ambiguous, pick the diagram type that answers it, and keep it as text (Mermaid or PlantUML) next to the spec. A good UI/UX diagram is directly testable: every state, transition, branch or message becomes code dev writes and a test tdd writes.

## Pick the diagram by the question

| Question | Diagram | UI/UX use |
|---|---|---|
| Who uses the system for what? | Use case | Scope of a feature per role; permissions |
| What steps and branches does a user go through? | Activity (flowchart), with swimlanes | User flows, wizards, approval processes |
| What does the UI exchange with the backend, in what order? | Sequence | Loading, optimistic updates, retries, error paths |
| Which states can a screen or component be in? | State machine | Idle/loading/empty/error/success, form validation, disabled rules |
| What data does a screen show and how is it related? | Class / ER | View models, entities displayed, cardinalities in lists |
| What timing constraints apply? | Timing | Debounce, autosave, toast duration, session timeout |
| Why do users fail here? | Cause-and-effect (fishbone) | Root-cause analysis of a usability defect |
| How is the frontend split and deployed? | Component, package, deployment | Micro-frontends, design-system package, CDN/edge |

Object diagrams (concrete instances) are useful as example data for tests; package diagrams show module dependencies.

## Use case diagrams

- Actors are roles or external systems, not people's names. Use cases are user goals ("Export report"), not screens or buttons.
- Association: actor participates in the use case.
- Include: the base use case always uses the included one (arrow from base to included, `<<include>>`).
- Extend: optional behavior inserted into a base use case under a condition (arrow from the extending use case to the base, `<<extend>>`).
- Each actor-to-use-case line is a permission decision: if the spec does not say which role may do it, ask product.

```plantuml
@startuml
left to right direction
actor Customer
actor "Support agent" as Agent
rectangle Orders {
  usecase "Place order" as UC1
  usecase "Pay" as UC2
  usecase "Apply coupon" as UC3
  usecase "Refund order" as UC4
}
Customer --> UC1
Agent --> UC4
UC1 ..> UC2 : <<include>>
UC3 ..> UC1 : <<extend>>
@enduml
```

## Activity diagrams (flows)

Rounded actions, labeled arrows, diamonds for decisions, swimlanes for who acts. Every decision needs all outcomes drawn, and every path must end.

```mermaid
flowchart TD
  subgraph Customer
    A([Open cart]) --> B[Enter shipping]
    B --> C{Address valid?}
    C -- No --> B
    C -- Yes --> D[Enter payment]
  end
  subgraph System
    D --> E{Payment authorized?}
    E -- Yes --> F([Show confirmation])
    E -- No --> G[Show error, keep entered data]
  end
  G --> D
```

## Sequence diagrams (UI and backend)

Lifelines for the user, UI, API and services; solid arrows for synchronous calls, dashed for replies; `alt`, `opt`, `loop` fragments for branches. Always draw the failure and slow paths, since they drive loading and error UI.

```mermaid
sequenceDiagram
  actor U as User
  participant UI
  participant API
  U->>UI: Click "Save"
  UI->>UI: Disable button, show spinner
  UI->>API: PUT /profile
  alt 200 OK
    API-->>UI: Updated profile
    UI-->>U: Success message (aria-live polite)
  else 422 validation error
    API-->>UI: Field errors
    UI-->>U: Inline errors, focus first invalid field
  else timeout or 5xx
    UI-->>U: Error with Retry, input preserved
  end
```

## State machines (the most useful UI diagram)

States, events on transitions, guards in brackets, actions after a slash. Model every screen or component whose behavior depends on async work or user input. Impossible combinations (loading and error at once) disappear when the UI is driven by one state value.

```mermaid
stateDiagram-v2
  [*] --> Editing
  Editing --> Submitting : submit [form valid]
  Editing --> Editing : submit [form invalid] / show field errors
  Submitting --> Success : response ok
  Submitting --> Failed : response error / announce error
  Failed --> Submitting : retry
  Failed --> Editing : edit
  Success --> [*]
```

```tsx
type FormState =
  | { status: "editing"; errors: Record<string, string> }
  | { status: "submitting" }
  | { status: "success"; id: string }
  | { status: "failed"; message: string };
```

tdd writes one test per transition (including the guarded self-loop) and one per state's rendering; dev implements with a reducer, discriminated union or a statechart library. Check also: what happens on double submit, navigation away mid-request, and session expiry.

## Class and ER diagrams for screens

Use them to agree on what a screen shows: entities, required vs optional fields, and cardinality (one order has many lines, so the UI needs a list with an empty state). Keep the persistence schema in the data or DBA skills; here model the view.

```mermaid
classDiagram
  class OrderView {
    string id
    Date placedAt
    OrderStatus status
    Money total
  }
  class OrderLineView {
    string productName
    int quantity
    Money price
  }
  OrderView "1" --> "1..*" OrderLineView
```

## Timing diagrams

Time on the horizontal axis, one lane per signal or state. Use them when the spec has durations: debounce delays, minimum spinner time to avoid flicker, autosave intervals, toast duration, session timeout warnings. Messages that disappear on a timer must give users enough time or a way to extend it (WCAG 2.2.1 Timing Adjustable).

```plantuml
@startuml
concise "Search input" as I
concise "Request" as R
@0
I is Typing
R is Idle
@300
I is Idle
@600
R is Pending
@1100
R is Results
@enduml
```

## Cause-and-effect for UX problems

Put the observed problem at the head ("40% abandon at payment step") and brainstorm causes under adapted 6 M categories: people (user skills, expectations), methods (flow, steps), machines (devices, browsers, assistive tech), materials (content, copy, data quality), measurements (analytics accuracy, how the drop was measured), environment (network, context of use). Then verify the top causes with data or tests before fixing; the diagram lists hypotheses, not findings.

## Diagrams as code

| | Mermaid.js | PlantUML |
|---|---|---|
| Runs | In the browser; rendered natively by many Markdown hosts | Java/server or CLI; outputs PNG, SVG, PDF |
| Strengths | Flowchart, sequence, state, class, ER, Gantt, quick edits | Full UML incl. use case, timing, component, deployment |
| Choose when | Diagram lives in Markdown docs or the spec | You need a UML type Mermaid lacks |

- Store diagram source in the repo beside the spec; review it in pull requests like code.
- Name states, events and actions with the domain language so they match code and tests.
- Provide a text alternative: a short summary plus the source or a list of states and transitions, since an image alone is not accessible.
- Do not rely on color alone to convey meaning in rendered diagrams.

## Decisions to hand off

| Decide | Dev implements | tdd / acceptance verifies |
|---|---|---|
| States and transitions per screen/component (state machine) | Single state value (union, reducer, statechart); UI renders from it | One test per transition and per state, incl. guards and invalid events |
| User flow steps and branches (activity) | Routes and step navigation; every branch reachable | Scenario per path; no dead ends |
| UI-API message order, loading, error and retry behavior (sequence) | Request handling, disabled controls, retry, focus and announcements | Tests with mocked API for success, validation error, timeout |
| Roles allowed per use case | Authorization checks in UI and API | Tests per role, including forbidden access |
| Data shown and cardinalities (class/ER) | View models, list and empty states | Rendering tests with 0, 1, many items and optional fields missing |
| Durations (timing) | Debounce, timeout, toast and autosave constants from one config | Fake-timer tests at boundary times |
| Gaps the diagram exposes (missing branch, unknown role, unspecified timeout) | Nothing | Open question to product/spec |

## Workflow

1. Read the spec and list the questions prose leaves ambiguous (states, branches, order, roles, timing).
2. Pick one diagram per question from the table; skip diagrams that answer nothing.
3. Draw it as Mermaid or PlantUML using domain terms, including error, empty and slow paths.
4. Walk every path against the spec; send gaps back to product rather than inventing behavior.
5. Review with dev and tdd; confirm each element maps to code and a test.
6. Commit the diagram source with a text alternative beside the spec.
7. Update the diagram when behavior changes; a stale diagram is worse than none.

## Red flags

- Diagrams drawn to decorate the spec, answering no question.
- Only the happy path drawn; no error, empty, timeout or permission branches.
- Decisions with a missing outcome, or flows that end nowhere.
- UI driven by several booleans (`isLoading`, `hasError`, `isEmpty`) that a state machine would make mutually exclusive.
- Use cases named after screens or buttons instead of user goals.
- Include and extend arrows reversed or used interchangeably.
- Diagrams as images with no source in the repo and no text alternative.
- Diagram names that differ from code and test names.
- Fishbone causes acted on without verification.

## Related

- `../../actions/uiux.md` — the workflow that consumes this skill and records its decisions.
- `../TaskAnalysis/taskAnalysis.md` — task breakdowns that become activity diagrams.
- `../Ideation/ideation.md` — storyboards that become flows and state machines.
- `../Implementation/implementation.md` — implementing the modeled states and flows in UI code.
- `../Testing/testing.md` — testing every modeled path.
- `../Affordance/affordance.md` — accessible feedback (focus, live regions) for state changes.
- `../../actions/tdd.md` — one test per transition and path.
- `../../TDD/Patterns/TDDPatterns/tddPatterns.md` — building the test list from diagram elements (when installed).
- `../../DataSystems/Foundations/DataModelsAndQueryLanguages/dataModelsAndQueryLanguages.md` — persistence models behind the view models (when installed).
- `../../CleanCode/Systems/systems.md` — component boundaries shown in component diagrams (when installed).
- `../../CleanCode/MeaningfulNames/ROOT.md` — naming states, events and actions (when installed).
