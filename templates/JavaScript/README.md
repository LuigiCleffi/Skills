## AI Skills

Before writing, testing, or reviewing JavaScript or TypeScript, find the
skills that apply to the code you are about to touch in the tables below and
read them.

Do not read every skill file by default. Read only the skills whose
"Use when" matches the task, and follow their references to other skills
only when needed. Start with the **Language** skills; read **Browser** or
**Node** only when the code runs there. The project chapters distill the
design lessons of the book's worked programs and are best used when
structuring state, a UI, an interpreter, or a server.

Each skill comes from one chapter of Marijn Haverbeke's *Eloquent
JavaScript*, 4th edition (2024). When `actions/dev.md`, `actions/tdd.md`,
`actions/bdd.md`, and `actions/review.md` are installed, they own the
workflow; these skills define how the JavaScript itself is written. Every
skill ends with "Red flags" for `dev` and `review` and "Testing notes" for
`tdd` and `bdd`, and carries a short "Current note" where the language or
platform has moved on since the book.

### Language (Part I)

| Ch | Skill | Use when |
|---|---|---|
| 0 | `./Language/Introduction/introduction.md` | Starting on a JS/TS codebase, choosing language level or runtime target, adding guard rails against silent errors, or judging the level of abstraction. |
| 1 | `./Language/ValuesTypesOperators/valuesTypesOperators.md` | Comparing values, choosing `==` vs `===`, defaulting with `??` vs `\|\|`, doing float or money arithmetic, handling `NaN`, or debugging coercion surprises. |
| 2 | `./Language/ProgramStructure/programStructure.md` | Declaring bindings (`const` vs `let`), writing conditionals, `switch` or lookup dispatch, loops and their exit conditions, or naming variables. |
| 3 | `./Language/Functions/functions.md` | Writing or extracting functions, choosing declaration vs arrow, handling optional arguments, using closures or recursion, or separating pure logic from side effects. |
| 4 | `./Language/DataStructures/dataStructures.md` | Modeling records or collections, copying or comparing objects, mutating vs returning new arrays, destructuring, optional chaining, or serializing JSON. |
| 5 | `./Language/HigherOrderFunctions/higherOrderFunctions.md` | Replacing loops with `filter`/`map`/`reduce`, writing callbacks, factories or wrappers, grouping or counting data, or processing Unicode text safely. |
| 6 | `./Language/SecretLifeOfObjects/secretLifeOfObjects.md` | Designing a class or object interface, hiding state with `#private`, using objects as dictionaries, making types iterable, or choosing inheritance versus composition. |
| 7 | `./Language/ProjectRobot/projectRobot.md` | Modeling application state, writing immutable state transitions or reducers, resisting a class per noun, implementing graph search, or comparing algorithms fairly. |
| 8 | `./Language/BugsAndErrors/bugsAndErrors.md` | Deciding how a function reports failure, writing or reviewing `try`/`catch`/`finally`, creating custom error classes, debugging `NaN`/`undefined`, or adding assertions. |
| 9 | `./Language/RegularExpressions/regularExpressions.md` | Validating, parsing, or replacing text with regex, building a `RegExp` from input, handling Unicode, or reviewing a pattern for correctness and ReDoS. |
| 10 | `./Language/Modules/modules.md` | Splitting code into ES modules, designing a module or package API, adding npm dependencies, mixing ESM and CommonJS, or fixing import cycles. |
| 11 | `./Language/AsynchronousProgramming/asynchronousProgramming.md` | Code waits on I/O, timers, or network; wrapping callbacks in promises; running work in parallel with `Promise.all`; adding timeouts or cancellation; debugging lost async errors. |
| 12 | `./Language/ProjectProgrammingLanguage/projectProgrammingLanguage.md` | Building or reviewing a parser, expression evaluator, rule engine, template or config DSL, or any recursive tree walker. |

### Browser (Part II)

| Ch | Skill | Use when |
|---|---|---|
| 13 | `./Browser/JavaScriptAndTheBrowser/javaScriptAndTheBrowser.md` | Adding scripts to a page, choosing `module`/`defer`/`async` loading, writing or injecting HTML, handling untrusted content, or checking browser API support. |
| 14 | `./Browser/DocumentObjectModel/documentObjectModel.md` | Querying, building, updating, styling, measuring, or animating page elements; reviewing DOM code for XSS, layout thrashing, or brittle selectors. |
| 15 | `./Browser/HandlingEvents/handlingEvents.md` | Wiring UI interactions, keyboard or pointer input, drag, shortcuts, debounce or throttle, listener cleanup, or moving heavy work to web workers. |
| 16 | `./Browser/ProjectPlatformGame/projectPlatformGame.md` | Building games, simulations, or other frame-loop UIs; separating immutable model state, a swappable display, and input tracking. |
| 17 | `./Browser/DrawingOnCanvas/drawingOnCanvas.md` | Rendering charts, games, or animations on canvas, choosing HTML/SVG/canvas, or debugging connected shapes, leaked transforms, and missed redraws. |
| 18 | `./Browser/HttpAndForms/httpAndForms.md` | Calling HTTP APIs with `fetch`, designing endpoints, handling form submission and validation, reading user files, or persisting data in `localStorage`. |
| 19 | `./Browser/ProjectPixelArtEditor/projectPixelArtEditor.md` | Structuring UI state and data flow, writing components or reducers, adding undo, wiring pointer or file input, or catching widgets that update each other directly. |

### Node (Part III)

| Ch | Skill | Use when |
|---|---|---|
| 20 | `./Node/NodeJs/nodeJs.md` | Building Node CLIs or HTTP servers, using `fs` and streams, managing npm dependencies, or reviewing for blocking I/O and path traversal. |
| 21 | `./Node/ProjectSkillSharingWebsite/projectSkillSharingWebsite.md` | Designing a JSON API, writing a router or middleware, pushing live updates (long polling or SSE), or splitting server and client responsibilities. |

# Context for AI: Writing JavaScript

## 1. The Goal

Write JavaScript that a reader understands at a glance and that fails loudly
instead of silently. The language forgives a lot: it coerces types, returns
`undefined` for missing properties, and lets any value flow anywhere. Good
JavaScript adds back the discipline the language does not enforce.

## 2. Defaults

- `const` by default, `let` when a binding must change, never `var`.
- `===` and `!==`; `??` for defaults when `0`, `""`, or `false` are valid.
- Small functions that compute values; side effects at the edges.
- Return new arrays and objects instead of mutating shared ones, unless the
  mutation is local and deliberate.
- ES modules with explicit imports and a small public surface.
- `async`/`await` with every promise awaited, returned, or explicitly handled.
- Throw `Error` subclasses for exceptional failures; never swallow errors in
  an empty `catch`.
- Treat every external string (user input, HTML, URLs, file paths) as
  untrusted.

## 3. How the AI Should Apply It

- Match the project's existing conventions (TypeScript or not, module
  system, test runner, lint rules) before applying a skill's preference.
- In `dev`, read the skills for the code you are about to write and check
  your change against their "Red flags" before reporting it done.
- In `tdd` and `bdd`, use each skill's "Testing notes" to choose assertions
  and avoid flaky async, timer, DOM, and network tests.
- In `review`, cite the skill and the red flag a finding comes from.
- Prefer the "Current note" over the book when they differ, and check the
  project's runtime target before using a newer API.
