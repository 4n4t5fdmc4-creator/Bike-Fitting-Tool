# Build prompts — closing the gap to the reference tool

Written 2026-09-01 after comparing the deployed app against
`road-bike-geometry-comparison.html`. Each prompt is self-contained and
shippable on its own. Work them in order: 1 and 2 unblock everything else.

## What is actually wrong today

| # | Symptom | Root cause |
|---|---------|-----------|
| A | The overlay "doesn't look like a bike" | `FrameOverlay.tsx` draws ONE `<polyline>` through `rear → bb → seatTop → headTop → headBottom → bb → frontAxle`. That is a zigzag, not a bicycle. There is no down tube, no seat stay, no horizontal top tube. |
| B | Frame shape is guessed | `outline.ts` invents seat tube length, fork length and front axle because the frame schema has no `effectiveTopTube`, `wheelbase`, `bbDrop` or `tyreMax` — even though those values were read off the manufacturer tables and then thrown away. |
| C | Only three bikes comparable | The three-slot palette cap was applied as a hard limit. The palette rule permits more **with secondary encoding**; direct labels on each frame are exactly that. The reference tool shows eight. |
| D | Researched frames missing | Basso SV, Wilier Rapida, Specialized Tarmac SL9 and Bianchi Infinito were all extracted and validated in conversation, then never written into `src/data/frames.ts`. Only the three Pinarellos are in there. |
| E | Cockpit tab does not compare | It is a single-bike slider panel. The reference has a two-bike "duel" with a contribution table that decomposes the hood difference into frame / stem / spacer / bar. |
| F | Matrix has no plot | It is a table only. The reference has a scatter plot with tolerance zones and stack-to-reach isolines. |

---

## Prompt 1 — Extend the frame schema and backfill real geometry

> The frame records in `src/data/frames.ts` and `StoredFrame` in
> `src/state/studio.ts` carry only stack, reach, headTubeAngle, seatTubeAngle,
> chainstay, headTubeLength and maxSpacerStack. Add these optional fields, all
> millimetres unless noted: `effectiveTopTube`, `wheelbase`, `bbDrop`,
> `forkRake`, `tyreMax`, `standover`, `trail`, plus `stockStem`, `stockStemAngle`
> and `stockSpacers` for the shipped build, and `cockpitType: 'open' |
> 'semi-integrated' | 'integrated'`.
>
> Keep them optional — a pasted table often lacks half of them, and the app must
> never refuse a frame for that. Make the paste importer and the manual form
> accept every new field, and extend the importer's synonym list to recognise
> them (`top tube`, `tubo orizzontale`, `oberrohr`, `wheelbase`, `radstand`,
> `interasse`, `bb drop`, `trail`, `max tyre`, `tyre clearance`).
>
> Then backfill the library with the geometries already verified in
> conversation, each with its source URL, and validate every row against
> `domain/validation.ts` bounds plus monotonicity across the size run before
> committing:
>
> - **Basso SV** — 7 sizes (45/48/51/53/56/58/61), from bassobikes.com. Note the
>   page labels two columns "Chain-Stay"; the ~406 mm one is the chainstay, the
>   ~575 mm one is front centre.
> - **Wilier Rapida** — 6 sizes (XS…XXL), from wilier.com. Sizes run across the
>   top; tube lengths are in **centimetres**, stack/reach in millimetres.
>   Column `A` is the seat tube angle, `A1` the head tube angle — the page has
>   no legend, the letters are only in a drawing.
> - **Specialized Tarmac SL9** — 7 sizes (44/49/52/54/56/58/61), from
>   specialized.com. Published as a vertical spec list per size, switched by
>   buttons; one paste per size.
> - **Bianchi Infinito** — 7 sizes (470…610), from bianchi.com. Letter columns:
>   `G` seat tube angle, `G1` head tube angle, `I` chainstay, `X` reach,
>   `Y` stack, `W` wheelbase, `E` head tube, `H` fork rake.
>
> Acceptance: every new frame passes the bounds check, stack and reach increase
> monotonically with size, and the frame list shows a working source link.

---

## Prompt 2 — Draw the frame correctly

> `src/engine/outline.ts` and `src/components/FrameOverlay.tsx` draw a zigzag,
> not a bicycle. Replace the single polyline with individually drawn tubes.
>
> Points, all BB-relative, +x forward, +y up:
>
> ```
> bb      = (0, 0)
> htTop   = (reach, stack)
> htBot   = (reach + ht·cos(hta), stack − ht·sin(hta))
> stTop   = (reach − effectiveTopTube, stack)        ← same height as htTop
> spTop   = (stTop.x − 110·cos(sta), stTop.y + 110·sin(sta))   ← seatpost above it
> rear    = (−√(cs² − bbDrop²), bbDrop)
> front   = (rear.x + wheelbase, bbDrop)
> spacer  = (htTop.x − sp·cos(hta), htTop.y + sp·sin(hta))
> clamp   = (spacer.x + L·cos(θ), spacer.y + L·sin(θ)),  θ = (90 − hta) + stemAngle
> hood    = (clamp.x + barReach, clamp.y + barRise)
> ```
>
> The top tube is HORIZONTAL — `stTop` sits at stack height, offset back by the
> effective top tube. That is the single biggest reason the current drawing
> reads wrong.
>
> Draw as separate lines, not one path: chainstay `bb→rear`, seat stay
> `rear→stTop`, seat tube `bb→spTop`, down tube `bb→htBot`, effective top tube
> `stTop→htTop` (dashed, thinner), head tube `htBot→htTop` (thickest), fork
> `htBot→front`, spacer stack `htTop→spacer`, stem `spacer→clamp`, bar reach
> `clamp→hood` (dashed). Filled dot at the hood, open ring at the BB.
>
> Wheels: radius `311 + tyreMax/2` (622 mm BSD), thin, low opacity, in the
> frame's own colour.
>
> Where a field is missing, fall back to a typical value as now — but keep the
> per-point `exact` flag and the disclosure line under the chart.
>
> Acceptance: a screenshot of the Pinarello Grevil F 550 is recognisable as a
> road bike — closed front triangle, horizontal top tube, wheels touching a
> common ground line.

---

## Prompt 3 — Raise the comparison cap and add the mode toggles

> Raise the overlay cap from three frames to **eight**, matching the reference
> tool. The three-slot palette limit applies to colour alone; direct labels on
> each frame are the secondary encoding that permits more. Extend the palette to
> eight slots and label each frame at its head tube.
>
> Add two toggle pairs above the chart, both from the reference tool:
>
> - **As fitted / Same cockpit.** "As fitted" draws each bike with its own
>   recommended build, so finished bikes are compared. "Same cockpit" gives
>   every bike the cockpit currently set on the sliders, so only the frames
>   differ.
> - **Align at BB / Align at hoods.** Aligning at the hoods is the one that
>   answers "same hand position, different bike" — the frames fan out behind a
>   shared grip point.
>
> Make the frame picker a chip row listing every frame in the library, showing
> the required build inline on selected chips (`92 / 18 / −6° · bar 76×5`).
>
> Acceptance: eight frames can be shown at once, each visually identifiable
> without relying on colour alone, and both toggles visibly change the drawing.

---

## Prompt 4 — Stack/reach scatter plot with tolerance zones

> The Matrix tab has a table but no plot. Add a scatter above it: frame reach on
> x, frame stack on y, one dot per size, coloured by model, with the reference
> frame marked and a crosshair through it.
>
> Overlay, in this order:
>
> 1. **Asymmetric tolerance zones** as four quarter-ellipses around the
>    reference, because short/long and low/high are tolerated differently. Inner
>    zone green, outer (2×) amber. Radii from four independently adjustable
>    tolerances: `xs` shorter-than, `xl` longer-than, `yl` lower-than, `yh`
>    higher-than. Defaults 12 / 8 / 15 / 10 mm.
> 2. **Stack-to-reach isolines** at 1.40, 1.45, 1.50, 1.55, 1.60, dashed and
>    recessive, labelled at the right edge.
> 3. Dot labels for the frames currently selected in the overlay tab.
>
> Wire the four tolerance numbers to sliders and use the SAME values for the
> matrix table's "in radius" column — one source of truth, not two.
>
> Build it as inline SVG using `lib/projection.ts`, not a charting library.
>
> Acceptance: moving a tolerance slider visibly resizes the zones and changes
> which table rows are marked in-radius.

---

## Prompt 5 — Hood-position plot

> Add a second plot mode alongside the stack/reach scatter: hood X against
> hood Y, both BB-relative — where the hands actually end up once the cockpit
> is applied, rather than where the frame ends.
>
> Overlay a **target window** rectangle from the same four tolerances, drawn
> around the reference position, labelled with the asymmetry
> ("target window: −12 / +8 in reach").
>
> Add a toggle for how each bike's hood position is computed: its own
> recommended build, or the cockpit currently on the sliders. Same distinction
> as the overlay's As-fitted / Same-cockpit switch — reuse that state rather
> than adding a second one.
>
> Acceptance: switching modes moves the dots; the reference bike sits at the
> centre of the target window in "as fitted".

---

## Prompt 6 — Two-bike cockpit comparison with contribution table

> Replace the single-bike Cockpit tab with a two-bike comparison, modelled on
> the reference tool's duel view.
>
> Pick bike A and bike B. Each gets its own independent slider set — stem
> length, stem angle, spacers, bar reach, bar rise. Persist each bike's cockpit
> so switching away and back does not lose it.
>
> Below, a table that decomposes the hood difference into exactly four
> contributions, for reach and stack separately:
>
> ```
> Frame reach / stack      reach, stack
> Stem contribution        L·cos(θ),   L·sin(θ)
> Spacer contribution      −h·cos(hta), h·sin(hta)
> Handlebar                barReach,    barRise
> ─────────────────────────────────────────────
> At the hoods             sum          sum
> ```
>
> The four rows must add up exactly to the bottom line — assert this in a test.
> That is the whole value of the view: it shows whether a difference lives in
> the frame, the stem, the spacers or the bar, and therefore whether it costs
> forty euros or a different bike.
>
> Highlight any Δ above 3 mm. Add a zoomed SVG of just the cockpit area — head
> tube, spacers, stem, bar — for both bikes overlaid, since the differences are
> invisible at whole-bike scale.
>
> Acceptance: a test proves the four contributions sum to the hood position for
> a spread of frames and cockpits; changing one slider moves exactly one row.

---

## Prompt 7 — Table columns the reference has and we do not

> Extend the Matrix table with: trail, wheelbase, chainstay, max tyre, cockpit
> type, stock build, and a source link per row. Mark the reference row. Add
> filters for tyre clearance ("35 mm+ only") and cockpit type, since an
> integrated cockpit collapses the adjustment range and a fitter needs to filter
> on it.
>
> Add an "adjustment left" column: how far the hood position could still move up
> and down within the frame's own spacer limit, rendered as a small bar.
>
> Keep the CSV export in step with whatever columns are shown.
>
> Acceptance: every column has a real source in the data — nothing computed from
> a guessed field without being marked as such.

---

## Prompt 8 — Flow and polish

> With the tabs carrying real content, tighten the flow:
>
> - Persist the active tab per client, so switching clients does not reset to
>   step 1.
> - Add a compact step indicator showing what is still missing ("no reference
>   bike set", "only 3 frames — add more to compare").
> - Make the frame picker state shared across Compare, Cockpit and Matrix, so a
>   selection made in one tab carries to the others.
> - Add print/PDF styling for the Matrix and Compare tabs — a fitter hands the
>   client something on paper.
>
> Acceptance: a full session — new client, enter reference bike, paste two
> geometry tables, compare, adjust cockpit, export — can be completed without
> re-entering anything.
