# Fit Scoring Engine

**Status:** Draft v1.0 · **Last updated:** 2026-09-01 · Companion to [product-spec.md](product-spec.md)

---

## 1. What the engine decides

Given a rider's target position and one frame in one size, the engine answers:

> Can this frame put my hands where they need to be, with parts a shop actually
> stocks — and how much room does that leave me?

It returns a score, a verdict, a set of diagnostic flags, the exact component
specification required, and a plain-language explanation.

---

## 2. Coordinate model

The primary fit axis is the **grip point measured from the bottom bracket**:

| Symbol | Meaning |
|--------|---------|
| `GR` | **Grip reach** — horizontal BB to hood grip centre |
| `GS` | **Grip stack** — vertical BB to hood grip centre |

This is the Accufit-style formulation, and it is the right primary axis because
it is the one quantity that a frame *plus* its cockpit produces, and the one the
rider actually feels.

Frame stack and reach remain first-class: they are the shopping vocabulary, they
appear in every geometry table, and they are what `GR`/`GS` decompose back into
when the engine explains itself.

### The saddle is a constraint, not a scoring axis

Saddle position is adjustable in ways the front end is not: seatpost setback
comes in 0/15/20/25 mm, rails give ±25–30 mm, and swapping a post is cheap. A
saddle target that cannot be met is a **gate**, and being near the edge of rail
travel is a **minor penalty** — but the saddle never drives the score. Getting
the bars right is the frame decision; getting the saddle right is an afternoon.

---

## 3. Why deviation is a weak signal

The engine has **three degrees of freedom** — spacer height, stem length, stem
angle — to hit a **two-dimensional** target. The system is over-determined.

Consequence, confirmed numerically: across a spread of realistic frames, almost
every one reaches the target grip point *exactly*, residual 0.0 mm. A scoring
function built on deviation therefore assigns 95+ to everything and discriminates
nothing.

**So the score is dominated by how extreme the required cockpit is, not by how
close the result lands.** Deviation only becomes significant when the solution
has to be clamped — when the frame physically cannot get there. This inverts the
weighting from the first draft of the product spec, which had position match at
0.40; §7.3 of that document is superseded by this one.

---

## 4. Algorithm outline

```
Stage 0  Normalise and validate         units, bounds, cross-field rules
Stage 1  Resolve assumptions            bar reach, hood offsets, spacer constants
Stage 2  Solve the cockpit              closed form, once per catalogue stem angle
Stage 3  Clamp to reality               spacer and stem limits, catalogue snapping
Stage 4  Score                          penalties from a 100-point start
Stage 5  Gate and classify              hard failures, verdict, diagnostic flags
Stage 6  Explain                        attribution, template selection
```

Stage 2 is not a search. See below.

---

## 5. The closed-form cockpit solve

Forward model — frame plus cockpit to grip point:

```
u      = spacerHeight + topCapHeight + stemClampHeight/2
theta  = 90 - HTA + stemAngle                    # stem rise above horizontal
Kx     = barReach + hoodForward                  # bar and lever, horizontal
Ky     = barRise  + hoodRise                     # bar and lever, vertical

GR = frameReach - u*cos(HTA) + L*cos(theta) + Kx
GS = frameStack + u*sin(HTA) + L*sin(theta) + Ky
```

Inverting for a **given** stem angle leaves two linear equations in two
unknowns, `u` and `L`:

```
A = GR_target - frameReach - Kx
B = GS_target - frameStack - Ky

  -cos(HTA)*u + cos(theta)*L = A
   sin(HTA)*u + sin(theta)*L = B
```

The determinant collapses neatly:

```
D = -cos(HTA)*sin(theta) - cos(theta)*sin(HTA)
  = -sin(HTA + theta)
  = -cos(stemAngle)                    since HTA + theta = 90 + stemAngle
```

`cos(stemAngle)` is never zero over the catalogue range (±17° → 0.956), so the
system is **always solvable**:

```
u = (A*sin(theta) - B*cos(theta)) / D
L = (-cos(HTA)*B - A*sin(HTA)) / D

spacerHeight = u - topCapHeight - stemClampHeight/2
```

**Engineering consequence.** Stem angle is the only discrete variable, and the
catalogue holds six values. The optimiser is therefore *six closed-form
evaluations*, not an iterative search — exact, deterministic, sub-microsecond,
and trivially explainable. Verified to 1e-14 mm against the forward model.

---

## 6. Pseudocode

```
function evaluateFrame(frame, target, library, assumptions):

    # --- Stage 1: constants from the chosen bar and levers ---------------
    Kx = bar.reach + levers.hoodForward
    Ky = bar.rise  + levers.hoodRise
    c  = assumptions.topCapHeight + stem.clampHeight / 2

    best = null

    # --- Stage 2 + 3: solve, clamp, measure ------------------------------
    for angle in library.stemAngles:                    # 6 values
        theta = 90 - frame.HTA + angle
        A = target.GR - frame.reach - Kx
        B = target.GS - frame.stack - Ky
        D = -cos(angle)

        u = (A*sin(theta) - B*cos(theta)) / D
        L = (-cos(frame.HTA)*B - A*sin(frame.HTA)) / D
        S = u - c                                       # required spacer height

        # What the rider can actually buy and build.
        S_real = clamp(S, 0, frame.maxSpacerStack ?? 40)
        L_real = snapToCatalogue(clamp(L, 70, 130), library.stemLengths)

        achieved = forwardGrip(frame, S_real, L_real, angle, Kx, Ky)
        residual = achieved - target

        # --- Stage 4: penalties ------------------------------------------
        p = penalties(S, L, S_real, L_real, angle, residual, frame, target)
        candidate = { angle, S, L, S_real, L_real, residual, p,
                      score: clamp(100 - sum(p), 0, 100) }

        if best == null or candidate.score > best.score:
            best = candidate

    # --- Stage 5: gates, verdict, flags ----------------------------------
    gates = hardGates(best, frame, target, rider)
    if gates.nonEmpty:
        return Infeasible(frame, gates, best)           # no score is emitted

    return Feasible(
        score:   best.score,
        verdict: verdictFor(best.score),
        flags:   flagsFor(best, frame, target),
        spec:    { stem: best.L_real, angle: best.angle, spacers: best.S_real },
        explanation: explain(best, frame, target)
    )
```

The saddle solve runs alongside and independently:

```
function saddleFeasible(frame, target, library):
    postAxisX = -target.saddleHeight * cos(frame.actualSeatAngle)
    for post in library.seatposts:
        clampX = postAxisX - post.setback
        noseX  = clampX + saddle.widthPointOffset
        needed = target.saddleSetbackFromBB * -1 - noseX     # rail offset required
        if abs(needed) <= post.railTravel:
            return Feasible(post, railOffset: needed,
                            margin: post.railTravel - abs(needed))
    return Gate('saddleSetback', shortfallOf(bestPost))
```

---

## 7. Penalty weights

Every candidate starts at 100 and loses points. Weights are per millimetre
unless stated.

### 7.1 Unreachable — the frame physically cannot get there

Only fires when the solution had to be clamped. Deliberately the harshest term:
this is the frame being wrong, not the parts.

| Term | Deadband | Weight | Rationale |
|------|----------|--------|-----------|
| `unreachableReach` | 3 mm | **3.0 / mm** | Reach errors are felt sooner than drop errors |
| `unreachableStack` | 3 mm | **2.0 / mm** | Riders adapt to height more readily |

### 7.2 Component centrality — always active

A gentle, continuous pull towards a neutral cockpit. This is what separates two
sizes that both reach the target exactly.

| Term | Neutral | Weight | Rationale |
|------|---------|--------|-----------|
| `stemCentre` | 100 mm | **0.35 / mm** | 100 mm is the handling-neutral centre of the range |
| `spacerCentre` | 15 mm | **0.30 / mm** | Leaves room to go both up and down later |

### 7.3 Component band — outside what a shop stocks comfortably

Escalating penalty once the solution leaves the ordinary range. Additive with
centrality, so extremes compound.

| Term | Comfortable band | Weight outside | Rationale |
|------|------------------|----------------|-----------|
| `stemBand` | 85–115 mm | **1.0 / mm** | Below 85 twitchy, above 115 vague and stressed |
| `spacerBand` | 5–30 mm | **1.0 / mm** | Under 5 no room to lower; over 30 a tall, flexy tower |

### 7.4 Configuration penalties — flat

| Term | Condition | Penalty | Rationale |
|------|-----------|---------|-----------|
| `flippedStem` | Positive stem angle (flipped up) | **5** | Works, but signals the frame is too low for the rider |
| `extremeAngle` | \|angle\| = 17° | **3** | Available but uncommon; limits future adjustment |
| `railNearLimit` | Saddle rail offset > 80% of travel | **4** | Saddle is adjustable, so this stays minor by design |
| `nonStockSeatpost` | Requires a different setback post | **3** | A real but cheap and easily solved change |
| `integratedCockpit` | Solution needs a proprietary part | **6** | Constrained catalogue, expensive, slow to source |

### 7.5 Safety and handling — flat

| Term | Condition | Penalty |
|------|-----------|---------|
| `toeOverlap` | Shoe can strike the front wheel at full lock | **12** |
| `lowStandover` | Clearance below 30 mm | **15** |
| `trailDeviation` | Trail differs from the reference bike by more than 8 mm | **8** |

---

## 8. Thresholds

### 8.1 Verdict — one per candidate, from the composite score

| Score | Verdict | Meaning |
|-------|---------|---------|
| **≥ 85** | `excellentFit` | Reaches the target with an ordinary cockpit and room to spare |
| **68–84** | `worksWithModerateAdjustment` | Reaches it, but needs specific parts or sits off-centre |
| **50–67** | `borderline` | Only at the edge of its adjustment range. Fits today, no room to evolve |
| **< 50** | `notRecommended` | Requires parts outside the ordinary range, or cannot reach the target |

Any hard gate forces `notRecommended` regardless of the arithmetic.

### 8.2 Diagnostic flags — zero or more, independent of the verdict

Verdict says *how well*; flags say *what is wrong*. Keeping them separate matters:
"borderline, too aggressive, requires too many spacers" is three facts, and
collapsing them into one enum loses two of them.

Flags are evaluated on the **unclamped** solve, because the question is what the
frame demands, not what survived clamping.

| Flag | Condition | Reading |
|------|-----------|---------|
| `tooAggressive` | Required spacers > max, or achieved stack more than 20 mm below target | Frame is built lower than the rider wants to ride |
| `tooRelaxed` | Required spacers < −8 mm, or achieved stack more than 20 mm above target | Front end is too tall; the rider cannot get low enough |
| `requiresTooManySpacers` | Required spacers > frame maximum (default 40 mm) | Structural limit, not a preference |
| `requiresExtremeStem` | Required stem < 70 mm or > 130 mm | Outside what shops stock; changes handling |
| `noRoomToLower` | Solution sits at 0 spacers | Fits now, cannot be adjusted lower later |
| `noRoomToLengthen` | Solution sits at the longest catalogue stem | Same, in the reach axis |
| `saddleNotReachable` | No seatpost and rail combination meets the setback target | Gate, not a flag |
| `assumedBarGeometry` | Bar model unknown, defaults used | Result carries ±10 mm extra uncertainty |

### 8.3 Sizing between two sizes

When two sizes of the same model are both `excellentFit` within 6 points, the
engine emits no winner. It reports the trade-off instead, naming which size
retains more adjustment headroom in each direction.

---

## 9. Explanation templates

> **Expanded.** The full copy system — voice rules, the generated comparison
> phrase grid, positive messages, warnings, handling and comfort tradeoffs, and
> assembly rules — lives in [explanation-system.md](explanation-system.md). What
> follows is the shape it is built on; that document supersedes this section
> wherever they differ.

Every explanation follows the same three-part shape, because a rider needs the
same three things every time:

```
VERDICT     what to do            one sentence, no hedging
MECHANISM   why the geometry does that   names the responsible property
REMEDY      what would change it  or an honest statement that nothing would
```

Slots are written `{likeThis}`. All numbers are rounded to whole millimetres —
the engine's precision exceeds the rider's ability to act on it.

### 9.1 Verdict templates

**`excellentFit`**
> The {size} puts your hands within {reachDev} mm of your target with a
> {stemLength} mm / {stemAngle}° stem and {spacers} mm of spacers. That is an
> ordinary cockpit, and it leaves {spacerHeadroomDown} mm to go lower and
> {spacerHeadroomUp} mm to go higher later.

**`worksWithModerateAdjustment`**
> The {size} reaches your position, but needs a {stemLength} mm stem
> {stemQualifier} and {spacers} mm of spacers. {limitingFactor} It will fit —
> just be aware you are {headroomDirection}.

**`borderline`**
> The {size} only reaches your target at the edge of what it can adjust:
> {atLimitDescription}. It would fit you today, but there is no room left to
> change your position later, and no margin if your measurements are slightly off.

**`notRecommended`**
> The {size} cannot put your hands where you need them. {primaryReason} No stem
> or spacer combination fixes this — {structuralExplanation}.

### 9.2 Flag templates

**`tooAggressive`**
> Even with the maximum {maxSpacers} mm of spacers, the bars sit {shortfall} mm
> below your target. This frame is built to be ridden lower than you want to ride
> it — its stack is {stackDelta} mm shorter than the frames that suit you.

**`tooRelaxed`**
> With no spacers at all, the bars still sit {excess} mm above your target. You
> cannot get low enough on this frame. Its stack of {frameStack} mm is
> {stackDelta} mm more than your position needs.

**`requiresTooManySpacers`**
> Reaching your bar height needs {requiredSpacers} mm of spacers, above the
> {maxSpacers} mm limit for this frame. That is a structural limit on the steerer,
> not a matter of preference — going past it is not an option we will recommend.

**`requiresExtremeStem`** *(too long)*
> Your reach needs a {requiredStem} mm stem. Above 130 mm the steering becomes
> vague and the load on the bars rises noticeably. The frame's reach of
> {frameReach} mm is {reachDelta} mm short for you — this is a sizing problem,
> not a cockpit problem.

**`requiresExtremeStem`** *(too short)*
> Your reach needs a {requiredStem} mm stem. Below 70 mm the steering gets
> nervous and the front end loses feel. The frame is {reachDelta} mm too long for
> you; the next size down is the fix.

**`noRoomToLower`**
> This works with the stem slammed directly on the headset. It fits — but if you
> ever want to go lower, you cannot.

**`assumedBarGeometry`**
> Your handlebar model is not known, so this assumes a {assumedReach} mm reach
> compact bar. If yours is a classic bend, your real reach is up to 20 mm longer
> than shown. Entering your bar removes this uncertainty.

### 9.3 Mechanism clause

Appended whenever the score is below `excellentFit`. Generated from the delta
attribution: the responsible property is named, with its size.

> {property} is {delta} {unit} {direction} than the frames that fit you, which
> accounts for {contribution} mm of the {total} mm difference.

Worked example:

> Frame reach is 14 mm longer than the frames that fit you, which accounts for
> 14 mm of the 22 mm difference. The slacker seat angle accounts for a further
> 6 mm.

### 9.4 Comparison clause

Used in the between-sizes case, where naming a winner would be false precision:

> Both sizes work. The {sizeA} needs a {stemA} mm stem and {spacersA} mm of
> spacers; the {sizeB} needs {stemB} mm and {spacersB} mm. The {sizeB} leaves
> more room to {directionB}, the {sizeA} more room to {directionA}. If you expect
> your position to get {likelyDirection} over time, take the {recommendedSize}.

### 9.5 Copy rules

1. **Never state a millimetre the rider cannot act on.** Round to whole mm; never
   report a residual below 3 mm as anything but "on target".
2. **Name the property, not the score.** "The head tube is 25 mm shorter" beats
   "position sub-score 62".
3. **Say when nothing can be done.** A `notRecommended` explanation that ends
   with a suggestion is dishonest.
4. **Never imply a body prescription.** The engine reports where the contact
   points land, never where the rider *should* sit.
5. **Surface every assumption that moved the result** by more than 5 mm.

---

## 10. Calibration evidence

Run against a spread of frames for one rider target — grip reach 590 mm, grip
stack 670 mm, roughly a 180 cm allround rider. Frame values are representative,
not manufacturer data.

| Frame | Stack | Reach | HTA | Required stem | Required spacers | Score | Verdict |
|-------|-------|-------|-----|---------------|------------------|-------|---------|
| Race 52 | 525 | 380 | 72.5 | 129 mm | 27 mm | 67.3 | borderline |
| Race 54 | 545 | 388 | 73.0 | 114 mm | 25 mm | 92.1 | excellent |
| **Race 56** | 565 | 395 | 73.5 | **101 mm** | **19 mm** | **98.2** | **excellent** |
| Race 58 | 585 | 403 | 73.5 | 89 mm | 10 mm | 94.9 | excellent |
| Race 60 | 605 | 412 | 73.5 | 77 mm | 0 mm | 70.8 | moderate |
| Endurance 54 | 570 | 380 | 71.5 | 116 mm | 8 mm | 91.1 | excellent |
| Endurance 56 | 592 | 387 | 72.0 | 106 mm | 9 mm | 93.0 | excellent |
| Gravel M | 595 | 383 | 71.0 | 110 mm | 4 mm | 89.5 | excellent |
| Allroad L | 610 | 392 | 71.5 | 96 mm | −10 mm | 71.2 | moderate · too relaxed |
| Comfort XL | 660 | 385 | 70.5 | 85 mm | −65 mm | 0 | not recommended · too relaxed |

The curve behaves as a fitter would: a clear peak at 56, workable neighbours at
54 and 58, both edges falling into borderline for the right reasons — a 129 mm
stem at one end, no spacers left at the other — and an unambiguous rejection when
the front end is 61 mm too tall to slam away.

**What this evidence does not establish.** It shows the ranking is *ordered*
sensibly. It does not show the thresholds sit in the right places, because there
is no ground truth here — only the author's judgement. See Q5 in the product
spec: the calibration set is 20 riders on bikes they already ride well, and the
engine must rank their own bike first.

---

## 11. Open calibration questions

| # | Question | Why it matters |
|---|----------|----------------|
| C1 | Is 100 mm the right stem neutral, or should it scale with frame size? A 130 mm stem on a 60 is less unusual than on a 50. | Biases large and small riders in opposite directions |
| C2 | Should `stemCentre` be linear or quadratic? Linear treats the 110th mm like the 101st. | Affects the gap between adjacent sizes |
| C3 | Is the 3:2 reach-to-stack severity ratio right? Asserted from fitting practice, not measured. | Directly sets which of two sizes wins |
| C4 | Should `tooAggressive` and `tooRelaxed` be flags or verdicts? They currently coexist with `borderline`. | Affects UI density |
| C5 | Does the flipped-stem penalty of 5 reflect how riders actually feel about it, or only how it looks? | Purely aesthetic penalties are hard to defend |
