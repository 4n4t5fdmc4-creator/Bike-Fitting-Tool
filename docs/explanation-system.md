# Explanation System

**Status:** Draft v1.0 · **Last updated:** 2026-09-01
Supersedes §9 of [scoring-engine.md](scoring-engine.md), which it expands.

---

## 1. Why a system rather than a list of sentences

Four verdicts × nine diagnostic flags × twelve attribution causes × the
adjustable-vs-structural distinction is well over a thousand situations. Writing
a sentence for each is unmaintainable and produces copy that drifts out of
agreement with the engine.

So every explanation is **assembled from four clauses**, each drawn from a small
inventory, with the numbers filled in from the engine:

```
┌── VERDICT ─────── what to do.                 Always present. One sentence.
├── MECHANISM ───── why the geometry does that. Present below "excellent".
├── REQUIREMENT ─── which parts change.         Present when anything changes.
└── CONSEQUENCE ─── what it costs you.          Present when there is a real cost.
```

A rider reads the verdict and stops, or keeps going. Nobody has to read four
sentences to learn the answer.

---

## 2. Voice

Written as a good fitter talks: direct, specific, never selling.

| # | Rule | Instead of | Write |
|---|------|-----------|-------|
| V1 | **Lead with the answer.** No preamble. | "Based on your measurements, we have analysed…" | "The 56 fits you." |
| V2 | **Millimetres, not adjectives.** | "a bit longer" | "14 mm longer" |
| V3 | **Name the part, never the score.** | "position sub-score 62" | "the head tube is 25 mm shorter" |
| V4 | **No hedging in the verdict.** Hedge in the consequence, where uncertainty is real. | "this might possibly not fit" | "This does not fit." |
| V5 | **Never prescribe a body.** The engine knows where contact points land, not where a body should sit. | "you should be lower" | "this puts you 20 mm lower than your current position" |
| V6 | **Say when nothing helps.** An explanation that ends in a suggestion when none exists is dishonest. | "you could try a shorter stem" *(when 60 mm is already too long)* | "No stem fixes this — the frame is too long for you." |
| V7 | **Separate adjustable from structural.** | "needs 55 mm of spacers" | "needs 55 mm of spacers, past this frame's 40 mm limit — a steerer limit, not a preference." |
| V8 | **Second person, active voice.** | "the bars would be positioned…" | "your hands sit…" |
| V9 | **Never imply medical or fitting authority.** | "this will fix your back pain" | "this position carries less reach than your current one" |
| V10 | **One idea per sentence.** Two clauses joined by "and" is usually two sentences. | | |

Numbers are always rounded to whole millimetres. The engine resolves finer than
a rider can act on, and false precision reads as false confidence.

---

## 3. Comparison phrases

The phrases in this section are **generated**, not authored per case — they must
agree with the numbers, and there are too many combinations to write by hand.

### 3.1 Bands

A delta on one axis maps to a magnitude band:

| Δ (mm) | Band | Reach word | Stack word |
|--------|------|-----------|-----------|
| 0–4 | same | — | — |
| 5–11 | slightly | slightly longer / shorter | slightly taller / lower |
| 12–24 | plain | longer / shorter | taller / lower |
| 25–39 | noticeably | noticeably longer / shorter | noticeably taller / lower |
| 40+ | much | much longer / shorter | much taller / lower |

### 3.2 Two outputs, always

Every comparison produces **a label and a precise phrase**. The label goes in
chips and headings; the precise phrase goes in prose. They never disagree,
because both come from the same two numbers.

```
(+18, −14)  →  label "more aggressive"     precise "18 mm longer and 14 mm lower"
(−22, +19)  →  label "more relaxed"        precise "22 mm shorter and 19 mm taller"
(+31, +28)  →  label "noticeably longer and taller"
                                            precise "31 mm longer and 28 mm taller"
```

### 3.3 Idioms on the diagonals

Two of the four quadrants have names a fitter actually uses; the other two do
not, and inventing one would be worse than the compositional form.

| Reach | Stack | Label |
|-------|-------|-------|
| longer | lower | **more aggressive** |
| shorter | taller | **more relaxed** |
| longer | taller | *(compositional)* "longer and taller" |
| shorter | lower | *(compositional)* "shorter and lower" |

The idiom carries a magnitude qualifier from the **stronger** of the two axes —
without it, +16/−18 and +45/−40 would read identically, which is a lie a rider
would act on.

The idiom fires only when **both** axes reach the plain band (≥ 12 mm). Below
that, the compositional form is more honest: a 6 mm reach change with a 14 mm
drop change is not "more aggressive", it is "slightly longer and lower".

### 3.4 Shared qualifiers collapse

When both axes land in the same band, the qualifier is stated once:
"much shorter and lower", never "much shorter and much lower".

### 3.5 Verified output grid

Rows are Δreach (+ = longer), columns Δstack (+ = taller). Generated, then read
for naturalness — this table is the generator's actual output, not a wish list.

| Δreach ↓ | −42 | −18 | 0 | +18 | +42 |
|---|---|---|---|---|---|
| **−45** | much shorter and lower | much shorter and lower | much shorter | much more relaxed | much more relaxed |
| **−28** | noticeably shorter and much lower | noticeably shorter and lower | noticeably shorter | noticeably more relaxed | much more relaxed |
| **−16** | shorter and much lower | shorter and lower | shorter | more relaxed | much more relaxed |
| **−7** | slightly shorter and much lower | slightly shorter and lower | slightly shorter | slightly shorter and taller | slightly shorter and much taller |
| **0** | much lower | lower | essentially the same | taller | much taller |
| **+7** | slightly longer and much lower | slightly longer and lower | slightly longer | slightly longer and taller | slightly longer and much taller |
| **+16** | much more aggressive | more aggressive | longer | longer and taller | longer and much taller |
| **+28** | much more aggressive | noticeably more aggressive | noticeably longer | noticeably longer and taller | noticeably longer and much taller |
| **+45** | much more aggressive | much more aggressive | much longer | much longer and taller | much longer and taller |

### 3.6 Other comparison vocabulary

For situations the two-axis grid does not cover:

| Situation | Phrase |
|-----------|--------|
| Front end cannot come up enough | "hard to get high enough on this frame" |
| Front end cannot come down enough | "hard to get low enough on this frame" |
| Spacer requirement past the limit | "would require excessive spacers" |
| Stem requirement past the range | "would need an unusually long stem" / "…unusually short stem" |
| Both sizes viable | "either size works" |
| Position matched, handling differs | "the same position on a longer bike" |
| At the edge of adjustment | "no room left to change your mind" |
| Stock parts already correct | "fits as it comes" |

---

## 4. Verdict messages

One per candidate. The first sentence a rider reads.

### `excellentFit`

> **The {size} fits you.**
> It reaches your position with a {stemLength} mm {stemAngle}° stem and
> {spacers} mm of spacers — ordinary parts, with {headroomDown} mm still
> available to go lower and {headroomUp} mm to go higher.

### `worksWithModerateAdjustment`

> **The {size} works, with the right parts.**
> Reaching your position needs {requirementSummary}. That is a real change but a
> normal one, and the result sits {precisePhrase} from where you ride now.

### `borderline`

> **The {size} only just works.**
> It reaches your position at the edge of what it can adjust: {atLimitPhrase}.
> It would fit today, with no room left to change your mind later and no margin
> if your measurements are slightly off.

### `notRecommended`

> **The {size} does not fit you.**
> {primaryReason}. {structuralClause}

Where `structuralClause` is one of:

- "No stem or spacer combination fixes this."
- "The next size {up|down} is the fix, not different parts."
- "This is a sizing problem, not a cockpit problem."

---

## 5. Positive recommendation messages

Praise is specific or it is noise. Each of these fires on a stated condition.

| Condition | Message |
|-----------|---------|
| Best in a size run, clear margin | "Of the sizes offered, the {size} is the one. It needs the most ordinary cockpit of the three and leaves the most room to adjust later." |
| Stock cockpit already correct | "This fits as it comes — the stock {stemLength} mm stem and {spacers} mm of spacers already put you where you want to be. Nothing to buy." |
| One cheap part away | "One part away: swap the stem for a {stemLength} mm and this is your position. Everything else stays." |
| Generous headroom both ways | "This leaves you room in both directions — {down} mm lower or {up} mm higher without buying anything. Useful if your position shifts over the next few seasons." |
| Closer to target than their current bike | "This puts you closer to your target than your current bike does: {currentDev} mm off now, {candidateDev} mm off here." |
| Two sizes both good | "Either size works. The {sizeA} needs {stemA} mm and {spacersA} mm; the {sizeB} needs {stemB} mm and {spacersB} mm. The {sizeB} leaves more room to go lower, the {sizeA} more room to go higher." |
| Feasible despite an ugly-looking number | "The {spacers} mm spacer stack looks like a lot and is well inside this frame's {maxSpacers} mm limit. It is fine." |

**Never** congratulate the rider, and never use "perfect". A frame that scores 98
still has a 2-point reason, and "perfect" makes the next sentence a contradiction.

---

## 6. Warning messages

One per flag or gate. Each names the mechanism and states whether it is fixable.

### Adjustment-range warnings

**`requiresTooManySpacers`**
> Reaching your bar height needs {requiredSpacers} mm of spacers, past this
> frame's {maxSpacers} mm limit. That is a limit on the steerer, not a matter of
> taste — we will not recommend going past it.

**`requiresExtremeStem` — too long**
> Your reach needs a {requiredStem} mm stem. Past about 130 mm the steering goes
> heavy and vague and more of your weight lands on your hands. The frame's reach
> is {reachDelta} mm short for you — this is a sizing problem, not a cockpit one.

**`requiresExtremeStem` — too short**
> Your reach needs a {requiredStem} mm stem. Below about 70 mm the steering turns
> nervous and the front wheel carries less weight, which you notice on steep
> climbs and in tight corners. The frame is {reachDelta} mm too long for you.

**`tooAggressive`**
> Even with the maximum {maxSpacers} mm of spacers, your hands sit {shortfall} mm
> below your target. This frame is built to be ridden lower than you want to ride
> it — its stack is {stackDelta} mm shorter than the frames that suit you.

**`tooRelaxed`**
> With no spacers at all, your hands still sit {excess} mm above your target. You
> cannot get low enough on this frame. Its {frameStack} mm stack is
> {stackDelta} mm more than your position needs.

**`noRoomToLower`**
> This works with the stem sitting directly on the headset. It fits — but there
> is nothing left to remove if you later want to go lower.

**`noRoomToLengthen`**
> This uses the longest stem we would recommend. It fits — but if your reach
> grows as you get used to the bike, there is nowhere to go.

**`flippedStemRequired`**
> This needs the stem flipped to point upwards. It works and costs nothing, and
> it raises your bars {rise} mm while shortening your reach {shorten} mm — both
> at once, which is worth knowing before you judge the result.

### Structural gates

**`seatpostMinInsertion`**
> Your saddle height leaves the seatpost inserted less than its marked minimum.
> This is a structural limit and the frame is unsafe for you at this height —
> a longer post may solve it, a larger frame certainly does.

**`standover`**
> You cannot stand over this frame. Its standover is {standover} mm against your
> {inseam} mm inseam.

**`saddleNotReachable`**
> No seatpost and rail combination puts your saddle where it needs to be —
> the setback target is {shortfall} mm beyond what this seat angle allows.

**`toeOverlap`**
> Your shoe can touch the front wheel on full lock. This only shows up below
> walking pace in tight turns, and most riders stop noticing it — but you should
> know before you buy, not after.

### Confidence warnings

**`assumedBarGeometry`**
> Your handlebar is not known, so this assumes a {assumedReach} mm compact bar.
> A classic bend would put your hands up to 20 mm further forward. Entering your
> bar removes this uncertainty.

**`effectiveSeatAngleAssumed`**
> This manufacturer publishes an effective seat angle. At your saddle height the
> real angle may differ by up to 1.5°, which is about 20 mm of saddle setback.
> The saddle numbers here are less certain than the bar numbers.

---

## 7. Tradeoff messages

The part most tools omit. A frame can reach the right position and still ride
differently, and a rider deserves to know which.

### 7.1 The compensation tradeoff — the important one

> **Matching the position does not match the bike.** A short stem on a frame
> that is 20 mm too long puts your hands in the right place, but the wheelbase,
> front-centre and weight distribution are still those of the longer frame. It
> will feel more stable and less eager to turn than the size that fits without
> compensation.

Mirror form:

> A long stem on a frame that is 20 mm too short puts your hands right, but moves
> more of your weight over the front wheel and lengthens the arc your hands travel
> to steer. The bike will feel quicker to turn in and heavier at the bar than the
> size that fits without compensation.

### 7.2 Handling

| Condition | Message |
|-----------|---------|
| Stem ≥ 120 mm | "A {stem} mm stem damps the steering and puts more weight on your hands. Stable at speed, less eager in tight corners." |
| Stem ≤ 75 mm | "A {stem} mm stem makes the steering quick and takes weight off the front wheel. You notice it climbing steeply and in fast corners." |
| Spacers ≥ 40 mm | "A {spacers} mm spacer tower flexes more than a short one. The front end feels less precise under hard braking." |
| Trail differs > 8 mm from current bike | "This steers {quicker|slower} than your current bike — {trailDelta} mm of trail difference — even with your hands in the same place." |
| Wheelbase differs > 30 mm | "Same position, {wheelbaseDelta} mm {longer|shorter} bike. Expect it to feel {more planted|more nimble} than what you ride now." |

### 7.3 Comfort

| Condition | Message |
|-----------|---------|
| Drop increases > 20 mm | "This puts you {drop} mm lower than you ride now. More load on your hands and more neck extension — worth building up to rather than switching overnight." |
| Drop decreases > 20 mm | "This sits you {drop} mm higher. Less load on your hands, more weight on your sit bones, and slightly more wind." |
| Spacers ≥ 40 mm | "The upright position costs you a little speed for the same effort. Whether that matters is your call." |
| Saddle rails near limit | "Your saddle sits near the end of its rails. It works, but a seatpost with {setback} mm of setback would put it in the middle of the range instead." |
| Slammed and steerer would be cut | "Getting this low means cutting the steerer. That is the one adjustment you cannot undo — be sure of the position before the saw comes out." |

That last one is the single most valuable warning in the system: every other
change is reversible.

---

## 8. Assembly rules

1. **Verdict is mandatory.** Everything else is conditional.
2. **At most four sentences** in the default view. Further detail lives behind
   "why", never in the first read.
3. **Order is fixed:** verdict → mechanism → requirement → consequence. Riders
   learn the shape and can skim to the part they want.
4. **One tradeoff maximum** in the default view — the largest by magnitude.
   Listing four makes every frame look bad.
5. **Structural warnings outrank comfort ones.** A frame you cannot stand over
   does not also get a note about wind resistance.
6. **`notRecommended` suppresses positives entirely.** No consolation.
7. **Confidence warnings appear last**, and only when the assumption moved the
   result by more than 5 mm.

---

## 9. Worked examples

**A frame that fits**

> **The 56 fits you.** It reaches your position with a 101 mm −6° stem and 19 mm
> of spacers — ordinary parts, with 19 mm still available to go lower and 21 mm
> to go higher.

**A frame that works with effort**

> **The 54 works, with the right parts.** It needs a 114 mm stem and 25 mm of
> spacers. Frame reach is 7 mm shorter than the 56, which the longer stem covers
> — but that stem also damps the steering slightly and moves a little more weight
> onto your hands.

**A frame at its limit**

> **The 60 only just works.** It reaches your position with the stem sitting
> directly on the headset and a 77 mm stem. It would fit today, with no room left
> to go lower and a stem short enough to make the steering feel quick.

**A frame that does not**

> **The Comfort XL does not fit you.** With no spacers at all your hands still
> sit 61 mm above your target — you cannot get low enough on this frame. No stem
> or spacer combination fixes this.

*(Every number in these four examples is taken from the calibration run in
[scoring-engine.md](scoring-engine.md) §10. Examples that invent plausible-looking
figures are how copy and engine drift apart.)*

---

## 10. Anti-patterns

| Don't | Why |
|-------|-----|
| "This bike is perfect for you" | Nothing scores 100. The next sentence contradicts it. |
| "You should ride lower" | Prescribes a body. Not the product's authority. |
| "Score: 92/100. Verdict: good." | A number is not an explanation. |
| "Unfortunately, this frame…" | Apologising for arithmetic. State it. |
| "You could try a shorter stem" *(when none exists)* | False hope. Say nothing helps. |
| "Slightly longer" *(when it is 31 mm)* | Adjectives instead of measurements. |
| Four warnings on one frame | Reads as disqualification. Show the largest. |
| "Based on your inputs, our algorithm has determined…" | Preamble. Delete it and start at the verdict. |
