---
name: strategy-putting-it-together
description: "How the sources of power combine in one strategy, using Rumelt's case of a graphics-chip challenger that rose to dominance: a diagnosis after a failed first product, a guiding policy that reduced complexity (one focused application, the industry's dominant technical approach, a faster release cycle than rivals), anticipation of demand and of platform standards, coherent actions that made the policy feasible (overlapping teams, simulation and emulation to remove delays, a unified driver architecture, new channel partners), riding a wave of change, using powerful buyers to bypass entrenched intermediaries, and rivals' inertia and overreach; plus lessons on rapid uptake when a product gives buyers an edge over others, denying scarce talent to rivals, and why past success does not guarantee the next wave, based on Chapter 15 (Putting It Together) of Good Strategy Bad Strategy by Richard Rumelt. Use when building a complete strategy end to end, writing a strategy case study or teardown, a challenger needs a cadence or speed-based advantage, a product launch cadence is being designed, channel intermediaries are blocking a better product, assessing why a competitor collapsed, or the user mentions full strategy, end-to-end strategy, release cadence, speed as advantage, channel conflict, challenger playbook, or 'show me how it all fits'."
---

# Putting It Together

A complete good strategy shows the kernel (diagnosis, guiding policy, coherent action) and many sources of power working at once: anticipation, a guiding policy that reduces complexity, design, focus, advantage, a wave of change, and rivals' inertia. Rumelt illustrates with a fabless graphics-chip startup that went from a failed first product to dominating high-performance PC graphics. Use the case as a checklist for assembling your own strategy.

## The case as a kernel

### Diagnosis

- The first product tried to set a broad multimedia standard with a quirky proprietary approach and flopped. Meanwhile a rival, using a simplified version of the established graphics approach and its own proprietary language, was capturing a new, intense demand.
- The real demand was not where pundits looked (virtual tours, home walk-throughs) but in fast 3-D action games, especially online competitive play, where a better graphics system was a life-or-death edge for the player. Executives reading sales statistics would miss it; players felt it immediately.
- Diagnosis drew on a technical advisory board of insiders and outside experts.

### Guiding policy

- **Focus**: drop multimedia; do 3-D graphics for desktop PCs only.
- **Adopt the dominant technical logic** (the established triangle-pipeline approach) instead of a proprietary one; stay fabless.
- **Anticipation on the supply side**: putting more of the pipeline on one chip, and spending each density gain on more parallel processors rather than cheaper chips, would raise graphics performance much faster than the industry's general pace.
- **Anticipation on the demand side**: buyers would absorb virtually all the graphics power offered, unlike demand for faster word processing.
- **Bet on an emerging open platform standard** rather than a rival's proprietary language, after meeting the standard's team and judging their commitment.
- **Speed as advantage**: release a substantial upgrade every six months instead of the industry's eighteen.

Rumelt's comment: a bad strategist would have wrapped 'faster cycle' in slogans about speed and growth. The point is the actions that make it real.

### Coherent actions

- **Three overlapping development teams**, each on an eighteen-month cycle, yielding a release every six months.
- **Remove delays**, since a slip hurts far more in a short cycle: heavy investment in logic and electrical simulation to avoid costly re-fabrication.
- **Take over driver software** (previously written late, inconsistently and secretively by board makers) with one unified driver architecture for all chips, downloadable, self-adapting; **emulation hardware** let driver work start months before chips existed.
- **Change the channel**: when an established board maker refused a new arrangement to protect its margins, the team went to a large PC maker, showed the economics, and shifted to contract manufacturers, who mostly chose to feature the chip brand.
- Commitment: the company put its remaining cash into emulation equipment and the next chip.

## Lessons beyond the kernel

- **Faster cycle math**: against a rival on an eighteen-month cycle, a six-month cycle means you have the best product most of the time (Rumelt estimates about 83%), plus launch buzz that substitutes for advertising and more learning for engineers.
- **Rapid uptake when a product gives buyers an edge over other people** (as early spreadsheets did for analysts, or graphics did for online players). Look for markets where customers compete with each other.
- **Technology changes industry structure**: the shift to 3-D removed most of the traditional board makers' value added; an intermediary whose value is disappearing will not fade away quietly; expect it to resist.
- **Powerful buyers can help a better product.** Standard analysis treats concentrated buyers as a negative, but they can let a superior product bypass entrenched intermediaries. With a me-too product, prefer fragmented buyers; with a better product, a powerful buyer can help it 'see the light of day'.
- **Success implies blocked competition.** The plan bet that rivals could not copy the release cadence, and they could not:
  - the early leader chased the mass market on advice from analysts and a new CEO, moved engineers to low-end products, imitated a famous ingredient-branding campaign, bought a board maker, then overstretched its next high-end chip and failed (the challenger's cadence induced its uncoordinated responses, enticing it to overreach);
  - a giant CPU maker used its standard 18–24-month process and would not redesign it for a sideline;
  - the original technology pioneer chased '50% growth' through acquisitions of fading workstation firms (classic bad strategy: a goal, not a response to its challenge) and went bankrupt.
- **Deny scarce talent to rivals.** The one rival that caught up did so by acquiring a small team of experts; when such talent is scarce and known, acquiring it is worth it even if you do not need it, to keep it from a competitor.
- **Waves end.** Once the pipeline was fully on one chip and buyers were no longer waiting for each release, the original wave waned, and the company moved to new bets (general-purpose computing on graphics chips, and a low-power system-on-chip 'disruption from below'), a two-pronged move with no guarantee.

Current note: the case runs to about 2010. The company's later rise as the platform for AI computing is a vivid example of its 'next wave' bet on general-purpose GPU computing, but that history is outside the book.

## Template: strategy assembly checklist

| Building block | Our answer |
|---|---|
| Diagnosis: what is going on; where real demand lies | |
| Guiding policy: focus, technical/market approach, chosen standard | |
| Anticipation: supply-side (technology, cost) and demand-side | |
| Source of advantage (speed, design, resource) | |
| Coherent actions that make the policy feasible | |
| Delay or bottleneck removal | |
| Channel and partner design; who blocks us; who can help | |
| Wave of change we ride | |
| Rival inertia: why each rival cannot or will not copy | |
| Scarce resources to secure or deny | |
| Signals the wave is waning; next bets | |

## Worked example: a challenger email-marketing platform for e-commerce

- **Diagnosis**: incumbents serve all industries with quarterly releases; e-commerce marketers compete with each other on promotions and need new channel features (SMS, new inbox rules, platform integrations) within weeks of changes, or they lose revenue to faster rivals.
- **Guiding policy**: e-commerce only; adopt the dominant store platform's data model rather than a proprietary one; ship a meaningful release every two weeks tied to channel and platform changes.
- **Anticipation**: privacy and inbox-provider rule changes will keep coming; demand for faster adaptation will not saturate soon.
- **Coherent actions**: parallel squads by channel; automated deliverability testing to avoid regressions; one integration layer maintained in-house rather than by agency partners; partner with the store platform's app marketplace (a powerful 'buyer' that can feature a better product) instead of relying on agencies that resell incumbents.
- **Rival inertia**: incumbents' release processes and multi-industry roadmaps cannot match the cadence; one may try to copy by acquisition, so recruit the small pool of deliverability experts early.
- **Watch**: when channel changes slow and features commoditize, shift to the next wave (for example, on-site personalization).

## Workflow

1. Write the diagnosis, including where the most intense demand actually is (talk to heavy users, not only market reports).
2. Draft a guiding policy that cuts complexity: one focus, the approach and standards to adopt, the dimension of advantage.
3. Make supply-side and demand-side anticipations explicit and check them.
4. Design the coherent actions needed to make the advantage feasible, especially removing bottlenecks and delays.
5. Map the channel: which intermediaries block a better product, and which powerful buyers or partners could help bypass them.
6. For each rival, state why it will not copy the key policies; plan to exploit or induce overreach.
7. Identify scarce resources (talent, partners, data) to secure or deny.
8. Define signals that the current wave is waning and the candidate next bets.

## Red flags

- 'Be faster' or 'be the standard' stated as slogans with no enabling actions.
- A launch cadence target with no investment in removing the causes of delay.
- Chasing the mass market and advertising before winning the most demanding users.
- Treating powerful buyers only as a threat when the product is genuinely better.
- Depending on intermediaries whose margins the strategy threatens.
- Assuming the wave that lifted you will continue.

## Related

- `../../GoodAndBadStrategy/KernelOfGoodStrategy/kernelOfGoodStrategy.md` — the kernel structure used here.
- `../Leverage/leverage.md` — anticipation and concentration.
- `../Design/design.md` — coordinated actions and trade-offs.
- `../Focus/focus.md` — a narrow target with a superior system.
- `../Dynamics/dynamics.md` — riding a wave of change.
- `../InertiaAndEntropy/inertiaAndEntropy.md` — why rivals could not respond.
- `../../../MarketingManagement/DeliveringValue/DistributionChannels/distributionChannels.md` — channel design and channel conflict.
- `../../../MarketingManagement/ManagingGrowth/NewOfferings/newOfferings.md` — new-product development cadence.
