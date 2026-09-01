# Geometry Ingestion Pipeline

**Status:** Draft v1.0 · **Last updated:** 2026-09-01
Companion to [product-spec.md](product-spec.md) §6.5 and [app-architecture.md](app-architecture.md)

---

## 1. The constraint that shapes everything

**A static site cannot fetch a manufacturer's page.** The browser's same-origin
policy blocks a cross-origin `fetch` unless that origin opts in with CORS
headers, and no bike manufacturer does. This is not a permissions or terms
question — the request simply fails.

That kills the obvious design ("paste a link, we read the table") for the
client-only MVP. It does not kill the goal. The workable ladder:

| Tier | Method | Infrastructure | Available |
|------|--------|----------------|-----------|
| **1** | Manual entry | none | MVP |
| **1** | **Paste the table** — rider copies the geometry table, pastes it in | none | MVP |
| **1** | CSV / TSV file | none | MVP |
| **2** | URL import via a minimal fetch service | one worker, ~30 lines | V1.1 |
| **3** | Curated database built from confirmed imports | review queue | V2 |
| **3** | Automatic search by brand and model | search index | V2 |

**Paste is the MVP path, and it is better than it sounds.** Selecting a table in
a browser and pressing copy yields tab-separated text with the structure intact.
The rider performs the retrieval themselves, which sidesteps both CORS and any
terms-of-service question about automated access. It costs one extra gesture.

Tier 2 is a read-only fetch proxy: one URL at a time, user-initiated, honouring
`robots.txt`, storing nothing. That is a categorically different activity from
harvesting a catalogue, and it is where the line sits.

---

## 2. Ingestion architecture

Every path — typed, pasted, uploaded, fetched — converges on the same pipeline
after the first stage. There is exactly one validator, one normaliser and one
review screen.

```
                 ┌── manual form ────┐
                 ├── paste (TSV/HTML)┤
   ACQUIRE  <────┼── CSV / TSV file  ┤
                 ├── URL (tier 2)    ┤
                 └── curated DB ─────┘
                          │
                          ▼
   EXTRACT     locate the geometry table in the blob
                          │
                          ▼
   ORIENT      sizes as columns or as rows?
                          │
                          ▼
   MAP         header text  ->  canonical field
                          │
                          ▼
   NORMALISE   units, decimal separators, ranges  ->  millimetres / degrees
                          │
                          ▼
   VALIDATE    bounds + cross-field rules from src/domain/validation.ts
                          │
                          ▼
   REVIEW      the rider confirms every value. Nothing saves unconfirmed.
                          │
                          ▼
   COMMIT      store with provenance, confidence and source attribution
```

### Module layout

```
src/ingest/
├── acquire/
│   ├── paste.ts          # clipboard text -> RawTable
│   ├── csv.ts            # file -> RawTable
│   ├── html.ts           # pasted HTML fragment -> RawTable
│   └── fetch.ts          # tier 2, behind a feature flag
├── extract.ts            # find the geometry table among several
├── orient.ts             # row/column detection
├── map/
│   ├── synonyms.ts       # the dictionary, multi-language
│   ├── match.ts          # exact -> abbreviation -> fuzzy
│   └── report.ts         # per-field mapping outcome
├── normalise/
│   ├── number.ts         # decimal comma, ranges, footnotes
│   ├── units.ts          # bounds-driven unit inference
│   └── angle.ts
├── confidence.ts         # the model in §5
├── attribution.ts        # the model in §6
└── types.ts              # RawTable, MappedTable, IngestResult
```

`src/ingest/` depends on `src/domain/` only. No React, no network except the
explicit `acquire/fetch.ts`.

---

## 3. Parsing strategy

### 3.1 Extract — which table is the geometry table?

A pasted page can contain several tables. Score each candidate:

- Does the header row contain ≥ 3 known geometry terms? (+3 each)
- Does any row or column contain size-like tokens (`47`–`64`, `XS`–`XXL`)? (+5)
- Are ≥ 70% of cells numeric? (+2)
- Table dimensions between 4×3 and 30×15? (+1)

Highest score wins; if two are within 20% of each other, ask the rider which.
Never silently pick.

### 3.2 Orient — sizes as columns or rows?

Both conventions are in wide use. Detection:

```
sizeTokens = /^(3[5-9]|4\d|5\d|6[0-5])(\.\d)?$|^(XXS|XS|S|M|ML|L|XL|XXL)$/i

if first row matches sizeTokens for >= 2 cells   -> sizes are COLUMNS
if first column matches for >= 2 cells           -> sizes are ROWS
if both or neither                               -> ask
```

The ambiguous case is real: a table whose first column holds `47 49 52` might be
listing sizes *or* seat tube lengths. When both interpretations parse, present
both and let the rider pick — one glance settles it.

### 3.3 Map — header text to canonical field

**Never pure fuzzy matching.** The cascade, stopping at the first hit:

1. **Normalise the header:** lowercase, strip units and parentheses, strip
   punctuation, collapse whitespace, fold diacritics.
   `"Steuerrohrwinkel (°)"` → `steuerrohrwinkel`
2. **Exact synonym lookup.** Confidence 1.0.
3. **Abbreviation table.** `STA`, `HTA`, `ETT`, `CS`, `WB`, `BB`. Confidence 0.95.
4. **Token-set similarity** (Dice coefficient over word tokens) against every
   synonym, threshold 0.72. Confidence 0.70, **always surfaced in review**.
5. **Unmapped.** Shown to the rider with a dropdown of unclaimed fields.

Synonym dictionary, abridged — the major brands publish in English, German and
Italian, so all three ship:

| Canonical | English | German | Italian |
|-----------|---------|--------|---------|
| `stack` | stack | stack, überhöhung | stack |
| `reach` | reach, horizontal reach | reach | reach |
| `headTubeAngle` | head tube angle, head angle | steuerrohrwinkel, lenkwinkel | angolo sterzo |
| `seatTubeAngle` | seat tube angle, seat angle | sitzrohrwinkel | angolo piantone |
| `headTubeLength` | head tube, head tube length | steuerrohr, steuerrohrlänge | tubo sterzo |
| `seatTubeLength` | seat tube, seat tube c-t | sitzrohr, rahmenhöhe | tubo piantone |
| `effectiveTopTube` | top tube horizontal, effective top tube, ETT | oberrohr horizontal | tubo orizzontale |
| `chainstayLength` | chainstay, rear centre | kettenstrebe | foderi bassi |
| `wheelbase` | wheelbase | radstand | interasse |
| `bbDrop` | bb drop, bottom bracket drop | tretlagerabsenkung | ribassamento movimento |
| `forkRake` | fork rake, fork offset | gabelvorbiegung, offset | avancorsa forcella |
| `standover` | standover, standover height | überstandshöhe | altezza cavallo |

### 3.4 The seat-angle trap

`"Seat tube angle"` alone is ambiguous, and the difference is up to 1.5° — around
20 mm of saddle setback for a tall rider. The mapper must record which variant it
saw and never collapse them:

```
"seat tube angle (effective)" | "effective seat angle" -> kind: 'effective'
"actual seat tube angle"                               -> kind: 'actual'
"seat tube angle" | "seat angle"                       -> kind: 'effective'  ← assumed
                                                          + flag effectiveSeatAngleAssumed
```

The bare form is assumed effective because that is what the overwhelming
majority of published tables mean — but the assumption is recorded, flagged in
review, and propagates a confidence penalty. It is never silently treated as
actual.

### 3.5 Normalise — numbers

Failure modes, all encountered in real tables:

| Input | Meaning | Handling |
|-------|---------|----------|
| `73,5` | European decimal comma | Comma is decimal when followed by 1–2 digits at end of token |
| `1,012` | Thousands separator | Comma is a separator when followed by exactly 3 digits and the result is plausible |
| `410–425` | Adjustable dropout | Store as a range; use the midpoint, flag `adjustableValue` |
| `570*` | Footnote marker | Strip trailing `*`, `†`, superscripts; keep the marker in the raw record |
| `n/a`, `—`, `-`, `` | Absent | Null, not zero. **Never coerce a missing value to 0.** |
| `56 / 22.0` | Dual units in one cell | Split; prefer the metric half |
| `~575` | Approximate | Accept, reduce confidence to 0.75 |

### 3.6 Normalise — units, inferred from bounds

The plausibility bounds already in `src/domain/validation.ts` do the work. For
each field, try each candidate unit and keep the interpretations that land inside
the hard bounds:

```ts
function inferUnit(field, raw) {
  const fits = (['mm','cm','in'] as const)
    .filter(u => withinHardBounds(field, convert(raw, u)))

  if (fits.length === 1) return { unit: fits[0], confidence: 0.90 }
  if (fits.length === 0) return { error: 'implausibleInEveryUnit' }
  return { unit: 'mm', confidence: 0.60, needsReview: true }   // ambiguous
}
```

A stack of `57` fits only centimetres; `570` fits only millimetres; `22.4` fits
only inches. The ambiguous residue is small and goes to review.

**Units can be mixed within one table** — Italian brands routinely give seat tube
and top tube in centimetres and everything else in millimetres. Inference is
therefore **per field, never per table**.

---

## 4. Normalised schema

The target is the existing `FrameGeometry` in `src/domain/geometry.ts`. Ingestion
adds a record wrapping it:

```ts
interface IngestedFrame {
  geometry: FrameGeometry            // canonical: mm and degrees
  attribution: SourceAttribution     // §6
  confidence: FrameConfidence        // §5
  raw: RawCapture                    // what arrived, verbatim
  review: ReviewRecord               // who confirmed, when, what changed
}

interface RawCapture {
  headers: string[]
  cells: string[][]
  sizeLabel: string
  capturedAt: string
  /** Hash of the raw text, to detect a changed source later. */
  contentHash: string
}
```

`raw` is retained deliberately. When a value later looks wrong, the question is
always "what did the page actually say?", and without the original capture that
is unanswerable.

---

## 5. Confidence model

### 5.1 Per field

Four independent factors, multiplied. Multiplication rather than averaging
because these are a *chain* of inferences: a perfectly mapped field with a
guessed unit is not "mostly fine".

```
fieldConfidence = acquisition × mapping × unit × validation
```

| Factor | Value | Score |
|--------|-------|-------|
| **Acquisition** | curated database | 1.00 |
| | manual entry by the rider | 0.95 |
| | CSV upload | 0.90 |
| | pasted table | 0.85 |
| | URL fetch (tier 2) | 0.80 |
| **Mapping** | exact synonym, or rider-assigned | 1.00 |
| | abbreviation | 0.95 |
| | fuzzy above threshold | 0.70 |
| **Unit** | stated explicitly in the header | 1.00 |
| | unambiguously inferred | 0.90 |
| | ambiguous, defaulted | 0.60 |
| | resolved by the rider in review | 1.00 |
| **Validation** | inside soft bounds | 1.00 |
| | inside hard bounds only | 0.75 |
| | cross-field warning | 0.80 |

Rider confirmation in review raises `mapping` and `unit` to 1.00 — a human
looked at it. It does **not** raise `acquisition`, because confirming a pasted
number does not make the paste a measurement.

### 5.2 Per frame — weighted by fit impact

A wrong wheelbase barely moves the recommendation; a wrong stack moves it
directly. Frame confidence weights each field by how much it drives the score:

| Field | Weight | Field | Weight |
|-------|--------|-------|--------|
| `stack` | 0.25 | `seatTubeLength` | 0.05 |
| `reach` | 0.25 | `chainstayLength` | 0.03 |
| `headTubeAngle` | 0.15 | `wheelbase` | 0.03 |
| `seatTubeAngle` | 0.15 | `bbDrop` | 0.02 |
| `headTubeLength` | 0.05 | `forkRake` | 0.02 |

```
frameConfidence = Σ(weight_i × fieldConfidence_i) / Σ(weight_i present)
```

Missing optional fields are excluded from both sums rather than scored as zero —
an incomplete table is less *complete*, not less *trustworthy*.

### 5.3 Feeding the fit engine

Confidence maps onto the `Sourced<T>` wrapper the domain already uses:

```
confidence >= 0.95  ->  provenance 'database' | 'measured',  sigma  2 mm
0.85 – 0.95         ->  'imported',                          sigma  4 mm
0.70 – 0.85         ->  'imported',                          sigma  8 mm
< 0.70              ->  'estimated',                         sigma 15 mm + review nag
```

These sigmas propagate into the score's confidence band, so a sloppily imported
frame visibly produces a softer answer rather than a falsely precise one.

---

## 6. Source attribution model

```ts
interface SourceAttribution {
  kind: 'curated' | 'manual' | 'csv' | 'paste' | 'url'
  /** Where it came from. Required for 'paste' and 'url'. */
  sourceUrl?: string
  /** What the rider says it is, when no URL exists. */
  sourceLabel?: string
  retrievedAt: string
  /** Hash of the raw capture — detects a manufacturer changing their table. */
  contentHash: string
  /** Known deviations in how this brand measures. */
  conventionNote?: string
  /** Explicit, per-frame opt-in. Default false. Nothing is shared implicitly. */
  shareable: boolean
  confirmedBy?: { at: string; changedFields: string[] }
}
```

Four rules:

1. **Every frame knows where it came from.** A value with no traceable origin
   cannot be defended when a rider disputes it.
2. **The raw capture is kept**, so a disagreement is resolvable by looking rather
   than by arguing.
3. **`shareable` defaults to false.** Imported data stays on the device.
   Contributing to a shared database is an explicit, per-frame decision.
4. **`contentHash` enables drift detection.** Manufacturers revise geometry
   tables silently between model years; a re-check that finds a different hash
   flags the entry for re-confirmation instead of quietly serving stale numbers.

### 6.1 On manufacturer data

Geometry values are measurements of physical objects — facts, not authorship.
Recording them with attribution is ordinary practice. The line this pipeline
holds is on *method*: retrieval is user-initiated and one frame at a time, the
source is always recorded, and nothing is redistributed without an explicit
opt-in. Bulk automated harvesting of complete catalogues is out of scope, and
tier 2 honours `robots.txt`.

---

## 7. Review before save

**Nothing reaches the library unconfirmed.** The review screen is not a
formality; it is where the pipeline's uncertainty becomes the rider's decision.

Layout: one row per field.

```
┌──────────────────────────────────────────────────────────────┐
│ Field            Extracted      Interpreted    Source cell    │
├──────────────────────────────────────────────────────────────┤
│ Stack            "570"          570 mm         ✓  col 3 row 2 │
│ Reach            "387"          387 mm         ✓               │
│ Head angle       "72,0"         72.0°          ✓  comma decimal│
│ Seat angle       "73.5"         73.5° effective ⚠ assumed      │
│ Seat tube        "54"           540 mm         ⚠ cm inferred   │
│ Chainstay        "410–425"      417 mm         ⚠ range, midpoint│
│ Wheelbase        "n/a"          —              ○ absent        │
└──────────────────────────────────────────────────────────────┘
```

- **Everything is editable**, including the field mapping.
- Rows are sorted **by uncertainty, not by table order** — the rider's attention
  goes where it is worth spending.
- ✓ high confidence, ⚠ needs a look, ○ absent. Icon plus text, never colour alone.
- The source cell reference is shown so a value can be traced back to the table.
- A running frame-confidence figure updates as the rider corrects fields.
- Cross-field violations block saving; bound warnings do not.

---

## 8. Error cases

| # | Case | Handling |
|---|------|----------|
| E-01 | No table found in the pasted content | Fall back to the manual form, pre-filled with any numbers recognised |
| E-02 | Several candidate tables | Present them; rider picks. Never guess silently |
| E-03 | Orientation ambiguous | Show both parses side by side |
| E-04 | Merged cells / `rowspan` | Forward-fill spanned values, flag every filled cell |
| E-05 | Size labels inconsistent (`54` vs `M`) | Keep the label verbatim; matching across models is not attempted |
| E-06 | Same canonical field claimed twice | Both shown; rider chooses. Common with effective vs actual seat angle |
| E-07 | Decimal comma misread as thousands | Bounds check catches it — `73,5` as `735` fails the angle bound |
| E-08 | Mixed units within one table | Per-field inference handles it by design |
| E-09 | Value implausible in every unit | Hard error on that field; the rest still imports |
| E-10 | Stack and reach entirely absent (pre-2010 tables) | Derivable from top tube, head tube and angles, but lossily. Offer it, mark `derived`, confidence 0.6 |
| E-11 | Passes bounds individually, fails cross-field | Block save, name the rule (e.g. wheelbase < chainstay) |
| E-12 | Source changed since import (hash mismatch) | Flag for re-confirmation; keep serving the old values meanwhile, visibly stale |
| E-13 | Frame already in the library | Offer merge, showing a field-level diff |
| E-14 | Geometry published only as a PDF | Rider copies from the PDF; same paste path. Layout is usually mangled — expect heavy review |
| E-15 | Geometry published only as an image | Out of scope. Direct to manual entry. OCR is a V2 question |
| E-16 | Non-Latin or unlisted language | Fuzzy stage fails; every field lands in the manual mapper. Degrades, never crashes |
| E-17 | CSV with no header row | Rider designates the header, or maps positionally |
| E-18 | Tier-2 fetch blocked by `robots.txt` or a 403 | Say so plainly and fall back to paste. Never route around a block |

The governing principle: **every error degrades to the manual form with whatever
was successfully parsed pre-filled.** A failed import is never a dead end.

---

## 9. Future — automatic search

Three stages, each usable before the next exists.

**S1 — Local search over the curated database.** Fuzzy match on brand, model and
year against what ships with the app. Zero infrastructure. Covers the common
case once the curated set is reasonably broad.

**S2 — Resolver service.** Rider types "Canyon Endurace CF SL 2024"; a service
returns candidate geometry pages; the rider picks; tier-2 fetch takes over.
This is a search-and-retrieve helper, not a crawler — it acts only on a specific
rider request.

**S3 — Community database.** Confirmed imports with `shareable: true` enter a
review queue. Two independent confirmations of matching values promote an entry
to curated. Attribution and content hashes carry through, so a disputed value can
always be traced to its source and its confirmers.

Change detection runs across all three: periodically re-hash known sources and
flag drift. Model-year revisions are the most common cause of a geometry entry
being quietly wrong.

---

## 10. Implementation order

| Phase | Scope | Exit criterion |
|-------|-------|----------------|
| **I1** | Manual entry form against `FrameGeometry`, with validation | A frame can be added by hand and scored |
| **I2** | CSV/TSV import, orientation detection, review screen | A geometry table saved as CSV imports correctly |
| **I3** | Paste path — clipboard TSV and HTML fragments | A table copied from a live manufacturer page imports |
| **I4** | Confidence and attribution models wired into the fit engine | Import quality visibly changes the score's confidence band |
| **I5** | Tier-2 fetch service behind a feature flag | A URL import works end to end, `robots.txt` honoured |
| **I6** | Curated seed database, ~200 frames | Common bikes need no import at all |

I1–I3 need no infrastructure and cover the realistic MVP. I5 is the first piece
that requires anything to be deployed beyond static files, and it should not be
started until I1–I4 are proven.
