# Bike Fitting Tool — Product Specification

**Status:** Draft v1.0 · **Owner:** Product · **Last updated:** 2026-08-31

---

## 1. Problem and positioning

Buying a road, gravel or endurance frame is a several-thousand-euro decision made
on the basis of a size chart that maps a single number — the rider's height — onto
a T-shirt size. That chart is wrong often enough to matter: two riders of identical
height routinely need different frames because inseam, torso and arm proportions
diverge by 40–60 mm at the contact points.

The information needed to do better is public. Every manufacturer publishes a full
geometry table. What does not exist is a tool that turns those tables into the one
answer a rider actually wants:

> *Can I sit on this bike the way I sit on my current bike — and what parts do I
> need to get there?*

**Positioning.** This is a **frame purchase decision tool** with a **fit-simulation
core**. Two jobs, one engine:

- *Buying:* which frame, which size, and what does it cost me in parts.
- *Fitting basis:* what happens to my position if I add 10 mm of spacers, flip the
  stem, or fit a bar with 20 mm of rise — on the bike I already own.

The second job is not a side feature. It is the same coordinate model applied to a
single bike instead of several, and it is what makes the tool useful after the
purchase decision is made.

What it is **not**: a virtual bike fit. It computes where the contact points *are*,
never where a given body *should* sit. The difference between "the geometry works"
and "your body works" is stated, not blurred.

### Product principles

| # | Principle | Consequence |
|---|-----------|-------------|
| P1 | Two layers: stack/reach to *shop*, contact points to *calculate* | Stack/reach are the shared vocabulary of every geometry table and the right filter for buying — they stay first-class in the UI. But they describe a *frame*, and a rider sits on a *saddle and a handlebar*, so every computation runs on BB-relative contact points. Neither replaces the other. |
| P2 | Never output a number without its cause | Every delta is decomposed into the geometry properties that produced it. |
| P3 | Adjustability is the product, not the score | A frame that needs a 140 mm stem "fits" arithmetically and fails in reality. Headroom is scored explicitly. |
| P4 | Honest uncertainty beats false precision | Where an input is estimated rather than measured, the output carries a visible confidence band. |
| P5 | The answer must survive a bike shop | Mobile, offline-capable, readable at arm's length under bad lighting. |

---

## 2. The core fit model

### 2.1 Coordinate system

All positions are expressed in a right-handed 2-D coordinate system in the bike's
sagittal plane:

- **Origin:** bottom bracket (BB) centre.
- **+X:** horizontal, toward the front wheel.
- **+Y:** vertical, up.
- **Units:** millimetres throughout. Degrees for angles.

This is the coordinate system used by professional motion-capture fit systems, and
it is the only representation in which a frame, a seatpost, a stem and a handlebar
can be compared on equal terms.

### 2.2 The three contact points

| Point | Symbol | Definition |
|-------|--------|------------|
| Saddle | `(SX, SY)` | Saddle Reference Point. **SRP = the point where the saddle measures 70 mm wide**, on the top surface. `SX` is negative for a saddle behind the BB. |
| Handlebar | `(HX, HY)` | Centre of the handlebar at the stem clamp. |
| Hoods | `(DX, DY)` | Centre of the brake lever hood grip — derived from `(HX, HY)` plus bar reach, bar drop and lever geometry. |
| Pedal | `(0, 0)` + `L_crank` | The BB is the origin by definition; crank length defines the foot circle. |

> **Why the 70 mm width point and not the saddle nose.** Nose-referenced setback
> stopped being transferable the moment short-nose saddles arrived: between a
> classic 275 mm saddle and a 240 mm short-nose model, up to 30 mm of the measured
> difference is pure definition, not position. The point at which the saddle is
> 70 mm wide sits under the rider's sit bones on essentially every road saddle
> shape, so it survives a saddle swap. This is standard fitting practice and the
> only saddle reference the tool accepts.

**A rider's position is fully described by `(SX, SY)`, `(HX, HY)` and `L_crank`.**
Two bikes that produce identical values feel identical, regardless of what their
geometry tables say.

### 2.3 Rider-facing derived metrics

These are what the UI shows; the coordinates are the engine underneath.

```
Saddle height (along seat tube axis)  SH  = distance BB -> saddle top, on the seat axis
Saddle setback                        SB  = -SX
Bar reach     (SRP -> bar centre)     BR  = HX - SX
Bar drop      (saddle top -> bar)     BD  = SY - HY
Hood reach                            HR  = DX - SX
Stack-to-reach ratio (frame only)     STR = stack / reach
```

### 2.4 Forward model — frame plus cockpit to contact points

Given a frame (`stack`, `reach`, `HTA`, `STA`, `seat_tube`) and a component set,
the contact points are:

**Handlebar.** Let `S` be total spacer height, `hs` the headset top-cap stack, `c`
the stem clamp height, and `L`, `alpha` the stem length and angle. Define
`u = S + hs + c/2` as the rise along the steering axis:

```
base_x = reach - u * cos(HTA)
base_y = stack + u * sin(HTA)

theta  = 90deg - HTA + alpha           # stem angle above horizontal
HX     = base_x + L * cos(theta)
HY     = base_y + L * sin(theta)
```

> **Convention note.** Stem angle `alpha` is measured relative to the perpendicular
> of the steering axis, which is how manufacturers label stems. Sanity check: on a
> 73° head angle, a −17° stem sits exactly horizontal (`theta = 0°`). A −6° stem on
> the same frame still *rises* 11°. This surprises users and must be explained in
> the UI, not hidden.

**Saddle.** Let `SH` be the target saddle height along the seat axis, `p` the
seatpost setback (0 / 15 / 25 mm are the common catalogue values), `w70` the
horizontal distance from the rail clamp to the 70 mm width point, and `r` the rail
adjustment (±30 mm of usable travel):

```
post_x = -SH * cos(STA) - p
post_y =  SH * sin(STA)

SX     = post_x + w70 + r
SY     = post_y + h_saddle          # rail-to-top-surface height, ~35 mm
```

`w70` is a **per-saddle-model constant**, not a guess: it is measured once and
stored in the saddle library. Typical values run 45–70 mm for short-nose models and
70–95 mm for classic shapes. Where the model is unknown, the tool uses 65 mm and
marks the result `estimated`.

**Critical modelling point.** `STA` must be the **actual** seat tube angle, not the
"effective" angle quoted in most geometry tables. Effective angles are stated at a
reference saddle height; a tall rider on a long extension sits materially further
back than the table implies. Where only the effective angle is published, the model
must flag reduced confidence (see §9, EC-04).

### 2.5 Inverse model — target position to required components

This is the Optimization engine. Given a target `(HX*, HY*)`, solve for the
component triple `(alpha, S, L)`:

- `alpha` is discrete — drawn from the catalogue `{-17, -6, 0, +6, +17}`.
- For each `alpha`, the system is two equations in two unknowns `(S, L)` and has a
  closed-form solution.
- Solutions are then filtered against physical limits (`0 <= S <= S_max`,
  `L` within available lengths) and ranked by **headroom**, not by exactness.

The saddle solve is simpler: `SY` fixes `SH`, and the achievable `SX` range follows
from the available post setbacks crossed with rail travel.

### 2.6 Handlebar and hood model

The stem places the **bar clamp centre**. It does not place the rider's hands.
Bar geometry moves the actual grip point by 20–40 mm, which is more than the
difference between two frame sizes — so the bar is modelled explicitly, not
folded into a constant.

Parameters per handlebar: `B_reach` (70–100 mm), `B_drop` (120–145 mm),
`B_rise` (0 for road drops, 15–40 mm for riser and gravel bars), `B_width`,
and `phi`, the bar's rotation in the stem clamp.

```
# Tops / grip point - the reference for riser and flat bars
GX = HX
GY = HY + B_rise

# Hoods - the dominant contact point on a drop bar
DX = HX + (B_reach + lever_fwd) * cos(phi)
DY = HY + (B_reach + lever_fwd) * sin(phi) + lever_up + B_rise

# Drops
PX = HX + B_reach*cos(phi) + B_drop*sin(phi)
PY = HY + B_reach*sin(phi) - B_drop*cos(phi) + B_rise
```

`lever_fwd` (~35 mm) and `lever_up` (~20 mm) describe where the hood grip sits
relative to the bar's forward extent. Both are per-lever-generation constants;
modern hydraulic levers sit noticeably further forward and higher than mechanical
ones, which is why a bar swap alone can absorb a full stem-length step.

### 2.7 Sensitivity — what a single change actually does

This is the fitting-basis half of the product. Every adjustment moves the bar in
**two dimensions at once**, and riders consistently underestimate the coupling.
Reference setup: 73° head angle, 20 mm spacers, 100 mm stem at −6°.

| Change | ΔHX | ΔHY | Effect on the rider |
|--------|-----|-----|---------------------|
| +10 mm spacers | −2.9 | +9.6 | 10 mm less drop — **and 3 mm less reach** |
| −20 mm spacers (slammed) | +5.8 | −19.1 | 19 mm more drop, 6 mm more reach |
| +10 mm stem length | +9.8 | +1.9 | 10 mm more reach, ~2 mm less drop |
| Stem −6° → −17° | +1.8 | −19.1 | 19 mm more drop at almost constant reach |
| Stem −6° → +6° (flipped up) | −6.1 | +20.0 | 20 mm less drop, 6 mm shorter |
| Frame reach +10 mm | +10.0 | 0.0 | pure reach |
| Frame stack +10 mm | 0.0 | +10.0 | pure drop |
| Bar rise +20 mm | 0.0 | +20.0 | at the grip, not the clamp |
| Bar reach +10 mm | +10.0 | 0.0 | at the hoods only |

Three consequences the UI must carry:

1. **Spacers are not a height-only control.** Adding 10 mm of spacers shortens
   reach by ~3 mm, because the steering axis is tilted. Riders who raise their
   bars and then feel cramped are experiencing exactly this.
2. **Stem angle is the clean drop control**, length is the clean reach control.
   The Optimization tab should say so rather than making the rider discover it.
3. **Only stack and reach move in one axis each.** That is precisely why they
   remain the right *frame-shopping* metric — and why they are insufficient once
   components enter the picture.

---

## 3. User personas

### Persona 1 — "Between Sizes" Bene (primary, ~45% of traffic)

Amateur road cyclist, 3–6k km/year, has ridden for years and knows his position.
Wants a specific new model; the size chart puts him on the boundary between 54 and
56. Has never been professionally fitted but has a bike that feels right.

- **Goal:** one recommendation with a reason he can verify himself.
- **Has:** his current bike's make/model/size, a tape measure, 20 minutes.
- **Fails when:** the tool gives a size without saying what changes at the contact points.
- **Success metric:** completes size decision in a single session.

### Persona 2 — "Upgrade Buyer" Ulrike (primary, ~25%)

Experienced rider replacing a 10-year-old bike. Modern geometry has moved — longer
reach, shorter stems, taller stacks — and she does not trust that her old size label
still means the same thing.

- **Goal:** carry her known-good position across a generational geometry shift.
- **Has:** precise knowledge of her current setup, high willingness to measure.
- **Fails when:** the tool compares frames instead of positions.

### Persona 3 — "Used-Bike Hunter" Umut (secondary, ~15%)

Evaluating a second-hand frame, often standing in a stranger's garage, on a phone,
under time pressure. Needs a go/no-go in under two minutes.

- **Goal:** avoid buying an unfixable frame.
- **Constraints:** mobile, one-handed, possibly no signal.
- **Fails when:** the flow requires more than three inputs before showing a verdict.

### Persona 4 — "Pain Sufferer" Petra (secondary, ~10%)

Has neck, hand or lower-back pain and suspects the bike. Not necessarily buying
anything — wants to know whether geometry explains her symptoms.

- **Goal:** understand whether her position is an outlier, and what would move it.
- **Risk:** this persona is the reason the product must never present itself as
  medical or fitting advice. Route her to the Optimization tab and to a real fitter.

### Persona 5 — "The Fitter" Frank (tertiary, ~5%, high strategic value)

Professional bike fitter who has measured a client's ideal position and now needs
to source a frame that reaches it. Wants to enter target coordinates directly and
screen a catalogue.

- **Goal:** filter many frames against one exact target.
- **Why he matters:** he is the credibility channel and the V2 monetisation path.

---

## 4. User journeys

### UJ-1 — Compare a candidate to my current bike *(use case 1)*

1. Rider enters current bike: model + size, or manual geometry.
2. Rider enters current cockpit: stem length/angle, spacer stack, saddle height,
   saddle setback. Assisted-measurement guide available for each.
3. System computes current `(SX, SY)`, `(HX, HY)` and locks them as the **target**.
4. Rider adds one or more candidate bikes and sizes.
5. **Fit Ranking** shows candidates sorted by score, each with the delta at the
   contact points in mm and the component change required.
6. Rider taps a candidate → **Geometry Explain** attributes the delta to causes.

*Exit criterion:* rider can state, in one sentence, why the recommended size wins.

### UJ-2 — Compare a candidate to an ideal setup *(use case 2)*

1. Rider has no reference bike, or an unsatisfactory one.
2. System derives a **target envelope** from body measurements and a riding-style
   selection (Comfort / Allround / Performance).
3. Envelope is presented as a *range*, not a point, with explicit confidence.
4. Rider may hand-adjust the target — every adjustment is retained and explained.
5. Proceeds as UJ-1 from step 4.

*Design constraint:* the derived target must be visibly less authoritative than a
measured one. Different visual treatment, not just a footnote.

### UJ-3 — Which size of this model? *(use case 3)*

1. Rider selects a model; system evaluates **all** its sizes at once.
2. Ranking shows the sizes on a single axis with the target marked between them.
3. Where two sizes are both feasible, the system states the trade-off explicitly —
   e.g. *"54 needs a 110 mm stem and 30 mm of spacers; 56 needs a 90 mm stem and
   10 mm. The 56 leaves more room to go lower later."*

*This is the highest-value journey and must be reachable in two taps from the home screen.*

### UJ-4 — What parts do I need? *(use case 4)*

1. From any candidate, rider opens **Optimization**.
2. System returns a small set of solutions, not a single answer:
   - **Closest fit** — minimum deviation, ignoring cost.
   - **Cheapest change** — fewest parts swapped from stock spec.
   - **Keep my stem** — reuse existing components.
3. Each solution lists parts, resulting coordinates, residual deviation, and any
   limit it sits against.

### UJ-5 — Why does this not fit? *(use case 5)*

1. Rider opens **Geometry Explain** for a rejected candidate.
2. System shows the delta decomposition (§7.4) and names the dominant cause.
3. Where the cause is unfixable (frame reach too long for any stem), it says so
   plainly and stops recommending parts.

---

## 5. Information architecture

```
Home / Garage
├── Rider Profile
│   ├── Body measurements        (height, inseam, torso, arm, shoulder width)
│   ├── Riding style + flexibility
│   └── Target position          (derived | measured | manual) ← single source of truth
├── My Bikes
│   ├── Current bike             (geometry + cockpit + contact points)
│   └── Saved candidates
├── Bike Library
│   ├── Curated geometry database
│   └── Manual entry / paste geometry table
│
└── Comparison workspace  ── the three tabs ──
    ├── TAB 1  Fit Ranking
    │   ├── Ranked candidate list with composite score
    │   ├── Contact-point delta per candidate (mm, signed)
    │   └── Required component change summary
    ├── TAB 2  Geometry Explain
    │   ├── Overlay diagram (frames aligned at BB)
    │   ├── Contact-point plot (target vs achieved)
    │   ├── Delta attribution breakdown
    │   └── Plain-language narrative
    └── TAB 3  Optimization
        ├── Solution set (closest / cheapest / reuse)
        ├── Component pickers with live coordinate feedback
        └── Limit and constraint warnings
```

**Navigation invariant.** The rider's target position is global state. Switching
tabs never changes it; switching candidates never changes it. Only the Rider
Profile can.

---

## 6. Required inputs

### 6.1 Rider (Tier 1 — required)

| Input | Unit | Range | Purpose | If missing |
|-------|------|-------|---------|------------|
| Height | cm | 140–210 | Coarse target derivation, sanity checks | Blocking |
| Inseam | cm | 60–100 | Saddle height, standover | Blocking |
| Riding style | enum | Comfort / Allround / Performance | Drop and reach targets | Default Allround |

### 6.2 Rider (Tier 2 — improves confidence)

| Input | Unit | Purpose |
|-------|------|---------|
| Torso length (C7 to saddle) | cm | Separates reach from height |
| Arm length (shoulder to wrist) | cm | Bar reach target |
| Shoulder width | cm | Handlebar width recommendation (V2) |
| Flexibility self-test | enum | Drop tolerance |
| Age / injury flags | enum | Conservative drop bias |

**Design decision.** Tier 2 inputs are optional but the UI must make their *value*
visible: "adding torso length narrows the reach estimate from ±25 mm to ±10 mm."
Riders will measure when the payoff is quantified.

### 6.3 Current bike (required for UJ-1)

Frame: `stack`, `reach`, `HTA`, `STA` (actual preferred), `seat_tube`, `head_tube`,
`chainstay`, `wheelbase`, `BB_drop`, `fork_rake`, `standover`.

Cockpit: stem length, stem angle, stem orientation (up/down), spacer stack,
headset top cap height, bar reach, bar drop, bar width, saddle model + length,
saddle height (BB to top along seat axis), saddle setback (BB to nose), crank length.

**Minimum viable subset:** saddle height, saddle setback, stem length, stem angle,
spacer stack, plus the frame's stack/reach/HTA/STA. Everything else has a
documented default.

### 6.4 Candidate bike

Same frame fields. Stock cockpit spec where known — this drives the "cheapest
change" solution. Integrated-cockpit flag is mandatory (see EC-05).

### 6.5 Geometry acquisition

Three paths, in order of preference. The tool must never be blocked by a frame it
does not know.

| # | Path | Behaviour |
|---|------|-----------|
| 1 | **Curated database** | Seeded, versioned, source-attributed. Instant, highest confidence. |
| 2 | **Import from URL** | Rider pastes the manufacturer's geometry page. A parser extracts the table, maps it onto the schema, and shows a **confirmation screen with every value editable** before anything is used. Never silently trusted. |
| 3 | **Manual entry** | Always available, never hidden behind the other two. Four fields (`stack`, `reach`, `HTA`, `STA`) are enough for a provisional result; the rest have defaults. |

Design rules for path 2:

- Parsing is best-effort and **fails loudly**. An unrecognised page returns the
  manual form pre-filled with whatever was extracted, not an error.
- Size-column detection is the hard part: geometry tables are wide, headers are
  inconsistent, and units vary. Extract *all* sizes, let the rider pick.
- Every imported frame records its source URL and import date, so a wrong value
  can be traced.
- Imports the rider confirms are candidates for the curated database (V2, with
  review).

**Open legal question (Q1):** geometry tables are factual data, but presentation
and scraping terms vary by manufacturer. Import is user-initiated and
user-confirmed, which is the defensible position; bulk scraping into a public
database is not, without permission.

### 6.6 Input quality model

Every input carries a provenance tag: `measured` · `from_database` · `estimated`
· `defaulted`. Provenance propagates into the output confidence band. A score
computed from four defaulted inputs must not look like a score computed from
measurements.

---

## 7. Scoring logic

### 7.1 Structure

Scoring runs in three stages. **A candidate never receives a composite score until
it has passed the feasibility gate** — a numerically close but physically
impossible frame must not outrank a slightly-off but buildable one.

```
Stage 1  Feasibility gate      -> pass / fail (+ reason)
Stage 2  Component optimisation -> best achievable (SX,SY,HX,HY) + parts
Stage 3  Composite scoring      -> 0-100 across four weighted sub-scores
```

### 7.2 Stage 1 — feasibility gate

Hard failures, each with a rider-readable reason:

| Gate | Condition | Message pattern |
|------|-----------|-----------------|
| G1 Reach floor | No `(alpha, S, L)` with `L >= 60 mm` reaches `HX*` | "Frame is too long — even a 60 mm stem overshoots by X mm" |
| G2 Reach ceiling | Requires `L > 140 mm` | "Frame is too short — would need a Y mm stem" |
| G3 Drop floor | `HY*` unreachable with `S = 0` | "Front end is X mm too tall even with no spacers" |
| G4 Drop ceiling | Requires `S > S_max` (frame-specific, default 40 mm) | "Would need Y mm of spacers" |
| G5 Setback | `SX*` outside all post-setback × rail-travel combinations | "Saddle cannot go far enough back on this seat angle" |
| G6 Seatpost extension | Required extension exceeds max, or below min insertion | "Seatpost limit" |
| G7 Standover | `standover > inseam - 20 mm` | "No standover clearance" |

### 7.3 Stage 3 — composite score

```
Score = 0.40 * S_position
      + 0.25 * S_headroom
      + 0.20 * S_constraints
      + 0.15 * S_components
```

**S_position — how close the achieved position is to target.**
Reach error is weighted more heavily than drop error, because riders detect a
10 mm reach change and tolerate a 10 mm drop change.

```
e_reach = |BR_achieved - BR_target|
e_drop  = |BD_achieved - BD_target|

S_position = 100 * exp( -( (e_reach/12)^2 + (e_drop/18)^2 ) )
```

Tolerance bands used in the UI:

| Band | Reach | Drop | Label |
|------|-------|------|-------|
| A | ≤ 5 mm | ≤ 8 mm | Indistinguishable |
| B | ≤ 12 mm | ≤ 18 mm | Adapts within a ride |
| C | ≤ 25 mm | ≤ 35 mm | Noticeably different |
| D | > 25 mm | > 35 mm | A different bike |

**S_headroom — remaining adjustment range.**
The core insight: a solution sitting at the edge of its adjustment range has no
room to evolve. Riders' positions change over years.

```
h_stem   = 1 - |L - 100| / 40            # 100 mm is the neutral centre
h_spacer = 1 - |S - 20| / 20             # 20 mm leaves room both ways
h_rail   = 1 - |r| / 30

S_headroom = 100 * clamp(0.4*h_stem + 0.35*h_spacer + 0.25*h_rail, 0, 1)
```

**S_constraints — safety and usability.**

| Check | Penalty |
|-------|---------|
| Toe overlap (front wheel vs. shoe at full lock) | −40 if present, scaled by severity |
| Standover clearance < 30 mm | −25 |
| Trail deviates > 8 mm from current bike | −15 (handling feel) |
| Front-centre implies < 45 % front weight bias | −10 |

**S_components — how ordinary the required parts are.**

| Condition | Score |
|-----------|-------|
| Stock spec already correct | 100 |
| Standard stem swap (70–120 mm, common angle) | 85 |
| Requires uncommon length (60, 130, 140 mm) | 55 |
| Integrated cockpit, required size exists in range | 50 |
| Integrated cockpit, required size unavailable | 0 (also fails G1/G2) |

### 7.4 Delta attribution — the Geometry Explain engine

The differentiating algorithm. Given a target position and a candidate, decompose
the total contact-point delta into per-property contributions by **one-at-a-time
substitution**: hold the reference bike constant, swap in one candidate geometry
property, and record the resulting movement of `(HX, HY)` and `(SX, SY)`.

```
for each property p in {reach, stack, HTA, STA, seat_tube, head_tube}:
    bike'      = reference with p replaced by candidate's p
    delta_p    = contact_points(bike') - contact_points(reference)

residual = total_delta - sum(delta_p)      # interaction terms, reported separately
```

Output, ranked by magnitude, rendered as a waterfall:

> Your bar sits **22 mm further forward**:
> · +14 mm — the frame's reach is 14 mm longer
> · +6 mm — the seat angle is 0.5° slacker, moving your saddle back
> · +3 mm — the taller head tube pushes the bar forward along the steering axis
> · −1 mm — interaction

This turns a score into an explanation, and it is what makes the tool defensible
against "the size chart said 56".

### 7.5 Confidence

The composite score is always reported with a band derived from input provenance:

```
sigma = sqrt( sum( sigma_i^2 * (d Score / d input_i)^2 ) )
```

Displayed as "Score 82 ± 6". A band wider than ±10 triggers a prompt naming the
single measurement that would narrow it most.

---

## 8. The three tabs

### Tab 1 — Fit Ranking

**Job:** answer "which one, and by how much" in five seconds.

- One row per candidate/size. Score, band letter, signed reach and drop deltas.
- Sort by score; secondary sorts by reach delta, price, availability.
- Inline component summary: *"90 mm / −6° / 15 mm spacers"*.
- Failed candidates are shown, greyed, with their gate reason — never hidden.
  A rider who does not see why the 52 was excluded will not trust the 56.
- Bulk mode for Persona 5: paste a catalogue, get a ranked screen.

### Tab 2 — Geometry Explain

**Job:** make the score legible and arguable.

- **Frame overlay** — candidate and reference superimposed at the BB, to scale,
  with contact points marked. The single most persuasive visual in the product.
- **Contact-point plot** — target zone as a rectangle in `(HX, HY)` space,
  achieved positions as points. Immediately shows inside/outside.
- **Attribution waterfall** — §7.4.
- **Narrative** — generated prose, three sentences maximum, naming the dominant
  cause and the fix.

### Tab 3 — Optimization

**Job:** convert a decision into a shopping list.

- Three solution cards: Closest fit · Cheapest change · Keep my parts.
- Live component pickers; every change re-renders coordinates instantly.
- Limit indicators: a slider that has hit `S_max` shows *why* it stopped.
- Explicit "unreachable" state — if no component set works, the tab says so and
  links back to Fit Ranking rather than offering a nearest-miss.

---

## 9. Edge cases

| ID | Case | Handling |
|----|------|----------|
| EC-01 | Toe overlap on small frames with long cranks | Compute from front-centre, crank length, shoe size, tyre width. Warn, never block — many riders accept it. |
| EC-02 | Standover unusable for step-through / sloping frames | Fall back to standover measured at the BB-to-top-tube midpoint; flag reduced meaning. |
| EC-03 | Seatpost min-insertion / max-extension violation | Hard gate G6. Common on small frames with tall riders — a real safety issue. |
| EC-04 | Effective vs. actual seat tube angle | Where only effective is published, estimate actual from seat tube length and flag confidence. Never silently treat them as equal. |
| EC-05 | Integrated cockpit — stem not swappable | Restrict the solve to the manufacturer's available cockpit sizes. If the required size is not in the catalogue, fail with that reason. This is increasingly the default on premium bikes and must be first-class, not an afterthought. |
| EC-06 | Saddle swap changes the reference | Solved by construction: the SRP is the 70 mm width point, which tracks the sit bones across saddle shapes. The remaining per-model variable is `w70` (clamp to width point). Ship a saddle library with measured values; where the model is unknown, default `w70 = 65 mm`, mark `estimated`, and offer a 30-second measuring guide. |
| EC-07 | Hood position dominates modern drop-bar reach | Lever reach adjustment moves the effective hood point 15–25 mm. Model hoods separately from bar centre. |
| EC-08 | Suspension sag (gravel / MTB) | Static geometry is not ridden geometry. Out of MVP scope; V2 applies a sag transform. |
| EC-09 | Tyre size changes BB height and standover | Recompute wheel radius from rim + tyre; affects standover and toe overlap, not contact points. |
| EC-10 | Manufacturers measure differently | Reach/stack are well standardised; chainstay and standover are not. Tag database entries with a source and a measurement convention. |
| EC-11 | Leg-length discrepancy / asymmetry | Out of scope. Detect the mention and route to a professional fitter. |
| EC-12 | Incomplete geometry table | Degrade gracefully: `stack`, `reach`, `HTA`, `STA` alone are enough for a provisional score. Every derived field states whether it was given or inferred. |
| EC-13 | Unit confusion (cm vs mm, inches) | Parse permissively, display canonically in mm, echo the interpretation back. |
| EC-14 | Rider between two feasible sizes | Do not force a winner. Present the trade-off and state which size preserves more headroom. |
| EC-15 | Target derived from a bad current bike | If the current position is a statistical outlier, say so before adopting it as the target. |

---

## 10. Scope

### MVP — ship in one release

**Included**

- Drop-bar bikes only: road, endurance, gravel, cyclocross.
- Full contact-point model (§2), forward and inverse.
- All five core use cases, all three tabs.
- Rider profile with Tier 1 + Tier 2 inputs; derived and measured targets.
- Geometry acquisition per §6.5: curated seed database (~200 frames), URL import
  with confirmation screen, manual entry.
- Saddle library with measured `w70` values for the 30 most common models.
- What-if mode on a single owned bike (spacers, stem, bar) — the fitting basis.
- Deterministic scoring with confidence bands.
- Delta attribution waterfall.
- Frame overlay and contact-point plot.
- Client-side only. No accounts; state in `localStorage`; shareable via URL-encoded state.
- Static hosting; works offline after first load.

**Explicitly excluded from MVP**

- User accounts, server, any personal data leaving the device.
- MTB, suspension, TT/triathlon.
- Handlebar width and crank length recommendations.
- Bulk scraping or redistribution of manufacturer geometry data.
- Price and availability data.
- Photo or video based measurement.

### V2

| Theme | Items |
|-------|-------|
| Data | Community-maintained geometry database with submission and review; integrated-cockpit catalogue; saddle library |
| Model | Suspension sag transform; MTB and TT support; crank length and bar width recommendations; power/aerodynamics trade-off |
| Measurement | Guided photo measurement of the current bike; smartphone-camera inseam |
| Accounts | Optional sync, multi-bike garage, position history over time |
| Fitter mode | Direct target-coordinate entry, batch catalogue screening, client reports, white-label export — the monetisation path |
| Distribution | Shop/brand embedding, affiliate integration |

---

## 11. UI/UX principles

1. **Answer first, evidence below.** Every screen opens with a verdict in plain
   language. Justification is one scroll away, never a prerequisite.

2. **Millimetres are the vocabulary.** Never "slightly longer" — always "14 mm
   longer". The product's authority rests on being specific.

3. **Show the excluded options.** Failed candidates stay visible with their reason.
   Hidden reasoning reads as arbitrary.

4. **Confidence is visible, always.** Estimated inputs produce visibly softer
   output — wider bands, lighter type, an explicit label. Never launder an
   estimate into a hard number.

5. **Progressive disclosure with a stated payoff.** Optional inputs advertise what
   they buy: "+torso length → reach estimate ±25 mm becomes ±10 mm".

6. **One overlay diagram beats ten numbers.** The BB-aligned frame overlay is the
   product's signature visual. It gets the space it needs.

7. **Direct manipulation.** Component pickers update coordinates live. The rider
   builds intuition by moving sliders, not by reading tables.

8. **Mobile is the primary target.** Persona 3 decides in a garage on a phone.
   Full functionality at 375 px, one-handed, offline.

9. **Never impersonate a bike fit.** The product recommends *frames*, not *positions*.
   Where a rider reports pain, the correct output is a referral, and the copy says so.

10. **Explain the counter-intuitive.** Negative stem angles that rise, effective
    seat angles that lie, integrated cockpits that cannot be adjusted. Each gets a
    short inline explanation the first time it becomes relevant.

---

## 12. Open questions

| # | Question | Needed by |
|---|----------|-----------|
| Q1 | **Resolved.** Geometry values are facts and are treated as usable. URL import is user-initiated, user-confirmed and source-attributed. The remaining line is bulk automated harvesting of complete catalogues against a site's terms — out of scope. | — |
| Q2 | **Resolved.** Both paths ship in MVP: reference bike is the primary entry point, body-measurement derivation is available but visibly lower-confidence. Open sub-question: what confidence delta do we state? | MVP design |
| Q3 | Confidence band presentation — numeric ±, or qualitative? Needs user testing. | MVP design |
| Q4 | Does the fitter persona justify a separate mode in MVP, or is it purely V2? | MVP scope lock |
| Q5 | Which validation set proves the scoring? Proposal: 20 riders with known good positions, verify the model reproduces their current bikes as top-ranked. | Before public launch |
