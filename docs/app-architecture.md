# Application Architecture

**Status:** Draft v1.0 · **Last updated:** 2026-09-01
Companion to [product-spec.md](product-spec.md) and [scoring-engine.md](scoring-engine.md)

---

## 1. Constraints that shape everything

Four constraints drive most decisions below. They are listed first because
several conclusions look arbitrary without them.

### C1 — Hosting is GitHub Pages, so the build is a static export

`next.config.mjs` sets `output: 'export'`. Consequences, all accepted:

- No route handlers, no server actions, no middleware, no ISR.
- `images.unoptimized = true`.
- Every route must be statically knowable at build time.

This costs nothing here. The engine is six closed-form evaluations
(§5 of the scoring engine doc) — microseconds, client-side. There is no server
work to do.

### C2 — Two environments from one Pages site, at different base paths

Production serves from `/Bike-Fitting-Tool/`, development from
`/Bike-Fitting-Tool/dev/`. Next.js bakes `basePath` in at build time, so the two
environments are **two separate builds**, not one artifact copied twice. The
deploy workflow must build each branch with its own `BASE_PATH`.

This replaces today's `rsync` step and is the single riskiest piece of the
migration.

### C3 — There is no Node toolchain on the developer machine

Every check runs in CI. This makes the round trip 60–90 seconds per iteration
and rules out interactive scaffolding (`npx shadcn init` prompts). Mitigations:
non-interactive flags, committed config, and a CI matrix that fails loudly.

> **Recommendation:** installing Node locally would cut iteration from ~90 s to
> ~2 s. Everything below works without it, but slowly.

### C4 — The domain layer stays framework-free

`src/domain/` already exists as pure TypeScript with zero imports. It must never
import React, Next, or anything else. Same for `src/engine/`. This keeps the fit
calculation testable in isolation, reusable outside the browser, and immune to a
future framework change.

---

## 2. Folder structure

```
bike-fitting-tool/
├── .github/workflows/
│   ├── deploy.yml              # two builds, one Pages artifact
│   ├── typecheck.yml           # exists
│   └── test.yml                # vitest, engine only
├── docs/                       # spec, scoring engine, this file
├── public/                     # static assets, favicon
├── src/
│   ├── app/                    # App Router — deliberately thin
│   │   ├── layout.tsx          # html/body, fonts, theme provider
│   │   ├── page.tsx            # the entire workspace, one route
│   │   └── globals.css         # Tailwind layers + design tokens
│   │
│   ├── domain/                 # EXISTS — types only, zero imports
│   │   ├── units.ts  rider.ts  geometry.ts  components.ts
│   │   └── fit.ts    scoring.ts  validation.ts  index.ts
│   │
│   ├── engine/                 # pure functions, no React
│   │   ├── forward.ts          # frame + cockpit -> contact points
│   │   ├── solve.ts            # closed-form inverse, 6 evaluations
│   │   ├── score.ts            # penalties -> score, verdict, flags
│   │   ├── saddle.ts           # seatpost/rail feasibility gate
│   │   ├── attribute.ts        # one-at-a-time delta attribution
│   │   ├── explain.ts          # template selection and slot filling
│   │   └── __tests__/          # the calibration table as fixtures
│   │
│   ├── data/                   # local mock data, swappable for an API later
│   │   ├── frames.ts           # ~20 frames across categories and sizes
│   │   ├── components.ts       # stems, bars, posts, saddles, levers
│   │   ├── riders.ts           # 3 demo profiles
│   │   └── index.ts            # loader interface the app codes against
│   │
│   ├── state/
│   │   ├── store.ts            # Zustand store + persist middleware
│   │   ├── selectors.ts        # memoised derived values
│   │   ├── url.ts              # search-param encode/decode
│   │   └── palette.ts          # stable entity->colour assignment
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn primitives, vendored
│   │   ├── layout/             # shell, tabs, rider bar
│   │   ├── controls/           # sliders and pickers
│   │   ├── viz/                # SVG charts
│   │   └── fit/                # domain-aware composites
│   │
│   └── lib/
│       ├── cn.ts               # class merge
│       ├── format.ts           # mm, degrees, signed deltas
│       └── projection.ts       # mm <-> SVG coordinate transform
│
├── components.json             # shadcn config
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Why one route, not three

The three tabs share a large, expensive state: rider target, candidate list,
cockpit configuration. Making them separate routes means a static export
produces three HTML documents that each re-hydrate the store on navigation, and
the transition between "see the ranking" and "explain this row" — the most
common move in the whole app — becomes a page load.

So: **one route, client-side tabs**, with the active tab mirrored into a search
param (`?tab=explain&bike=…`) so links, the back button and sharing all work.
The cost is a slightly larger first bundle, mitigated by lazy-loading the two
non-default tab panels.

---

## 3. Layering rule

Dependencies point one way only:

```
domain  <--  engine  <--  state  <--  components  <--  app
   ^                        ^
   |________________________|
        (types only)
```

- `domain` imports nothing.
- `engine` imports `domain`. No React, no browser APIs.
- `state` imports `domain` + `engine`.
- `components` import `state` and `domain` types. **Components never call the
  engine directly** — they read derived values from selectors, so there is
  exactly one place where the calculation happens.
- `app` composes. No logic.

Enforced by an ESLint `no-restricted-imports` rule per directory, checked in CI.

---

## 4. Component breakdown

### 4.1 `components/ui/` — shadcn primitives

Vendored, not a dependency. Needed set:

`button` · `card` · `badge` · `slider` · `tabs` · `select` · `input` · `label` ·
`tooltip` · `separator` · `sheet` · `table` · `popover` · `switch` ·
`toggle-group` · `skeleton` · `scroll-area` · `accordion`

### 4.2 `components/layout/`

| Component | Responsibility |
|-----------|----------------|
| `WorkspaceShell` | Page frame, responsive grid, theme |
| `TabNav` | The three tabs, URL-synced |
| `RiderSummaryBar` | Persistent strip: target grip reach/stack, confidence, edit affordance |
| `CandidateSelector` | Add/remove frames; owns colour assignment |
| `MobileSheet` | Controls drawer below 768 px |

### 4.3 `components/controls/`

All controls share one primitive so limits and units behave identically.

| Component | Notes |
|-----------|-------|
| `ControlRow` | Label, value, unit, limit markers, reset. The shared shell. |
| `StemControl` | Length slider (60–140), angle `toggle-group` (−17/−12/−6/0/+6/+17), flip switch |
| `SpacerControl` | Height slider 0–60 with a hard marker at the frame maximum |
| `HandlebarControl` | Reach, drop, rise, rotation; preset picker for known models |
| `SeatpostControl` | Setback select (0/15/20/25) + rail offset slider, travel bounds shown |
| `CockpitPanel` | Composes the four; "reset to stock", "copy from my bike" |
| `RiderForm` | Tier 1 required, Tier 2 progressive with stated payoff |

**Limit rendering is a first-class requirement, not decoration.** A slider that
stops must show *why* — the frame maximum, the rail travel, the catalogue range.

### 4.4 `components/fit/`

| Component | Responsibility |
|-----------|----------------|
| `ScoreBadge` | Verdict + score. Status colour **plus icon plus label** — never colour alone |
| `FlagChip` / `FlagList` | Diagnostic flags with tooltips |
| `CandidateCard` | Comparison card: frame, score, required cockpit, headroom |
| `RankingTable` | Sortable; infeasible rows shown greyed with their gate reason |
| `CockpitSpecSummary` | `101 mm · −6° · 19 mm` in one glance |
| `HeadroomMeter` | Remaining adjustment in both directions |
| `ExplanationPanel` | Verdict → mechanism → remedy, from the templates |
| `ConfidenceBadge` | `82 ± 6`, with what would narrow it |
| `TradeoffNote` | Between-sizes case, where naming a winner is false precision |

### 4.5 `components/viz/` — see §6

---

## 5. State model

### 5.1 Four kinds of state, four homes

| Kind | Example | Home | Why |
|------|---------|------|-----|
| **Persistent** | Rider profile, garage, target | Zustand + `persist` to `localStorage` | Survives reloads; never leaves the device |
| **Shareable** | Active tab, selected candidates, active row | URL search params | A link reproduces the view |
| **Ephemeral** | Slider mid-drag | Local `useState`, committed on release | Keeps drags out of persistence |
| **Derived** | Scores, contact points, attribution | Memoised selectors | **Never stored** |

### 5.2 Never store a derived value

Scores, contact points, verdicts and explanations are recomputed from inputs.
Storing them creates two sources of truth and the staleness bugs that follow.
The calculation is cheap enough that this costs nothing: ten candidates × six
stem angles is sixty closed-form evaluations.

### 5.3 Why Zustand

Redux' async machinery buys nothing when every computation is synchronous and
sub-millisecond. React Context re-renders every consumer on any change, which is
exactly wrong when a slider drag must not repaint a ranking table. Zustand gives
selector-level subscriptions with no provider ceremony.

### 5.4 Store shape

```ts
interface AppState {
  rider:      RiderProfile | null
  target:     IdealFitProfile | null
  garage:     CurrentBike[]
  candidates: CandidateSelection[]   // frame + colour + cockpit override
  library:    ComponentLibrary
  budget:     ChangeBudget
  ui:         { activeTab, activeCandidateId, overlayMode, showTable }
}
```

`CandidateSelection` holds a **`colorSlot`** assigned at selection time.

### 5.5 Colour follows the entity, never its rank

A candidate keeps its colour when the table is re-sorted, when another candidate
is removed, and when a filter changes the visible set. Deriving colour from array
index repaints survivors and silently breaks the link between a legend and a
chart. The slot is assigned on add, released on remove, and never recycled while
the session lives.

### 5.6 Slider performance

A drag recomputes every candidate. The engine cost is negligible; re-rendering
six SVG frames at 60 fps is not. Strategy:

- The **active** candidate updates synchronously — direct manipulation must feel direct.
- Everything else is wrapped in `useDeferredValue`.
- The overlay animates position via CSS transform, not by re-issuing path data.

---

## 6. Visualization strategy

### 6.1 SVG, not canvas

A frame is roughly twelve paths; three frames plus wheels, markers and axes is
under 150 elements. Canvas only wins past ~1000. SVG buys, at no cost here:
crisp rendering at any zoom, CSS-themeable strokes (so dark mode is a token
swap), real DOM nodes for hover and focus, accessibility roles, and clean
server rendering into the static export.

### 6.2 One projection, shared by every layer

The domain works in millimetres with **+y up**; SVG has **+y down**. Converting
per-component is how two layers end up at different scales — the classic bug in
overlay charts.

So there is exactly one `useFrameProjection(frames)` hook. It computes a bounding
box across **all displayed frames together** and returns `{ toSvg, viewBox, scale }`.
Every layer — frames, wheels, contact points, target box, annotations — uses it.
Frames are never scaled individually.

```ts
// Single sign flip at the projection boundary, nowhere else.
const toSvg = (p: BbPoint) => ({ x: (p.x - minX) * s, y: (maxY - p.y) * s })
```

### 6.3 The three visuals

| # | Visual | Form | Job |
|---|--------|------|-----|
| 1 | `FrameOverlay` | Superimposed line drawings, BB-aligned | Identity + shape comparison |
| 2 | `GripPointPlot` | Scatter in (grip reach, grip stack) space, target box overlaid | Position relative to target |
| 3 | `AttributionWaterfall` | Horizontal waterfall, single mm axis | Magnitude of each cause |

**On the "one axis" rule.** The grip-point plot is a *coordinate* plot: both axes
are millimetres in the same physical space. That is not a dual-axis chart, which
would put two different measures on two scales. The distinction matters and the
rule is respected.

### 6.4 The overlay caps at three frames

The validated categorical palette clears the all-pairs colour-difference floors
for **its first three slots only**. An overlay is an all-pairs case — any two
frames sit adjacent visually — so four or more frames cannot be told apart
reliably by colour, and re-stepping a documented palette is not permitted.

The cap is therefore: **one reference frame plus two candidates.** Beyond that,
the UI switches to **small multiples** — a facet grid of individual frames at a
shared scale, each with the reference ghosted behind it.

This is the right product decision independently: six superimposed frames is an
unreadable tangle, and the useful comparison — "my bike versus these two" — is
exactly three.

### 6.5 Colour assignment

| Role | Light | Dark | Use |
|------|-------|------|-----|
| Series 1 | `#2a78d6` | `#3987e5` | First candidate |
| Series 2 | `#eb6834` | `#d95926` | Second candidate |
| Series 3 | `#1baf7a` | `#199e70` | Third, or the reference when three candidates are shown |
| Reference | `--text-secondary` | `--text-secondary` | The rider's current bike — dashed, recessive |

Status colours are **reserved** and never used for a series:

| Verdict | Status role | Hex |
|---------|-------------|-----|
| `excellentFit` | good | `#0ca30c` |
| `worksWithModerateAdjustment` | warning | `#fab219` |
| `borderline` | serious | `#ec835a` |
| `notRecommended` | critical | `#d03b3b` |

Every status carries an **icon and a text label**. On the light surface, warning
and serious sit below 3:1 by design — the icon-plus-label pairing is the
mitigation, not an optional nicety.

### 6.6 Mark specification

- Frame tubes: **2 px** stroke, round joins, `vector-effect: non-scaling-stroke`.
- Reference frame: same weight, `stroke-dasharray: 4 3`, secondary ink.
- Contact points: **≥ 8 px** markers with a **2 px surface-coloured ring** so
  overlapping points stay separable.
- Target box: translucent fill at the series-agnostic accent, 1 px dashed border.
- Wheels: 1 px, `--border` token — context, not data.
- Grid and axes: recessive; never darker than the lightest data mark.
- Text uses **ink tokens, never the series colour**. A coloured swatch beside a
  label carries identity; the label itself stays legible.

### 6.7 Interaction

Interactive by default, per the visualization rules:

- `FrameOverlay`: hover a frame → its tubes lift, others recede to 40% opacity;
  tooltip gives frame name, size, stack/reach, required cockpit.
- `GripPointPlot`: per-point tooltip with grip reach/stack and deviation from target.
- `AttributionWaterfall`: per-bar tooltip with the full sentence for that term.
- Hit targets are larger than the marks — an invisible padded `<rect>` per frame.
- Legend always present for ≥ 2 series; with ≤ 3 series, direct labels at each
  frame's head tube as well, so identity never rests on colour alone.

### 6.8 Accessibility

- Every chart: `role="img"` plus `<title>` and `<desc>`.
- Every chart has a **table view** toggle rendering the same numbers as a real
  `<table>`. This is the primary mitigation for both contrast relief and screen
  readers, and it is genuinely useful sighted-reader functionality.
- Keyboard: frames are focusable in ranking order; arrow keys move between them.
- `prefers-reduced-motion` disables the morph transition; positions jump instead.
- Texture fill (45°/135° line hatching) available under `forced-colors` and for
  the accessibility setting.

---

## 7. Design system — dark modern

### 7.1 Tokens

Tailwind is configured against CSS custom properties, so shadcn components and
charts read the same tokens.

```
--background      page plane        dark #0d0d0d   light #f9f9f7
--card            chart surface     dark #1a1a19   light #fcfcfb
--foreground      primary ink       dark #ffffff   light #0b0b0b
--muted-foreground secondary ink    dark #c3c2b7   light #52514e
--border, --input, --ring
--series-1..3, --status-good/warning/serious/critical
```

Dark is **selected, not inverted** — its own steps validated against the dark
surface, per the palette reference.

### 7.2 Visual language

- Surfaces are near-black, not blue-black; the accent carries the colour.
- One elevation step: cards sit on the plane via a hairline border, not a shadow.
- Radius `10px` throughout; nothing pill-shaped except status badges.
- Type: one variable sans (Inter or Geist) plus **tabular numerals everywhere a
  measurement appears** — a column of millimetres that jitters while dragging a
  slider looks broken.
- Motion: 120–160 ms, ease-out, position and opacity only.
- Density: measurements are the content. Generous line height in prose,
  tight in tables.

---

## 8. Implementation plan

Each phase ends with something verifiable in CI or visible at `/dev/`.

### Phase 0 — Toolchain migration *(highest risk)*

Next.js static export, Tailwind, shadcn, and a deploy workflow that builds both
branches with their own `basePath`.

- `next.config.mjs` with `output: 'export'`, `basePath: process.env.BASE_PATH`.
- `deploy.yml` rewritten: build `main` with `/Bike-Fitting-Tool`, build `develop`
  with `/Bike-Fitting-Tool/dev`, assemble one artifact.
- shadcn initialised non-interactively; `components.json` committed.
- **Exit:** both URLs serve a Next-rendered page; typecheck and build green.

### Phase 1 — Engine *(no UI)*

Implement `forward`, `solve`, `score`, `saddle`, `attribute`, `explain` against
the existing domain types.

- Vitest suite seeded with the calibration table from the scoring engine doc.
- Round-trip property test: forward → solve → forward within 1e-9 mm.
- **Exit:** the size run reproduces the documented scores; `test.yml` green.

### Phase 2 — Data and state

Mock frames, components and riders behind a loader interface. Zustand store,
selectors, URL sync, colour slots.

- **Exit:** store drives a debug page listing scored candidates as plain text.

### Phase 3 — Fit Ranking tab

`RankingTable`, `CandidateCard`, `ScoreBadge`, `FlagChip`, `CockpitSpecSummary`,
`CandidateSelector`. Infeasible rows visible with reasons.

- **Exit:** a rider can pick frames and see a defensible ranking.

### Phase 4 — Geometry Explain tab

`useFrameProjection`, `FrameOverlay`, `GripPointPlot`, `AttributionWaterfall`,
`ExplanationPanel`, table views.

- **Exit:** the overlay is to scale, three-frame cap enforced, every chart has a
  table view.

### Phase 5 — Optimization tab

`CockpitPanel` and the four controls, live recomputation, three solution cards,
limit indicators, honest unreachable state.

- **Exit:** dragging a slider updates the overlay and the score at 60 fps.

### Phase 6 — Polish

Mobile sheet, keyboard paths, reduced motion, confidence surfacing, empty and
error states, Lighthouse pass.

### CI gates added along the way

| Workflow | Gate |
|----------|------|
| `typecheck.yml` | exists — strict `tsc --noEmit` |
| `test.yml` | Vitest, engine coverage threshold |
| `deploy.yml` | `next build` must succeed before deploying |
| lint | ESLint with the layering rule from §3 |

---

## 9. Risks and open questions

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Phase 0 migration breaks the working deployment | Do it on `develop` only; `/dev/` may break, `/` cannot. Merge to `main` only when `/dev/` is verified. |
| R2 | `basePath` differs between environments; a hardcoded path breaks one of them | Never write literal paths. One `assetPath()` helper reading the build-time base. Add a CI check for literal `/Bike-Fitting-Tool` in source. |
| R3 | No local Node makes iteration slow | Recommend installing Node. Until then, batch changes per CI round trip. |
| R4 | shadcn's initialiser is interactive | Run with `--defaults --yes`; commit `components.json`; vendor components by copy if the CLI misbehaves. |
| R5 | The bundle grows past what a phone on shop wifi tolerates | Lazy-load non-default tab panels; budget check in CI. Persona 3 decides in a garage. |
| R6 | The three-frame overlay cap frustrates users who want to compare six | Small-multiples fallback is part of Phase 4, not a later addition. |

| # | Open question | Needed by |
|---|----------------|-----------|
| Q6 | Is the three-frame cap acceptable as the primary comparison, with small multiples as the escape hatch? | Phase 4 design |
| Q7 | Should the URL encode the full rider profile, or only a share token? Full encoding makes long links; body measurements in a URL is also a privacy question. | Phase 2 |
| Q8 | Vitest or node:test? Vitest is heavier but the ecosystem default. | Phase 1 |
