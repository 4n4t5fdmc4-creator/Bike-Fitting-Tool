# Bike Fitting Tool

Compare bike frames, geometries and adjust to individual personal needs.

A frame purchase decision tool with a fit-simulation core: it answers *which frame
and which size*, *what parts do I need to get there*, and *what happens to my
position if I change one thing*.

## Status

Specification phase. Implementation has not started.

- **[Product specification](docs/product-spec.md)** — fit model, personas, scope.
  Start here.
- **[Scoring engine](docs/scoring-engine.md)** — algorithm, penalty weights,
  thresholds, explanation templates.
- **[Application architecture](docs/app-architecture.md)** — folder structure,
  components, state model, visualisation strategy, implementation plan.
- **[Explanation system](docs/explanation-system.md)** — the copy system: voice,
  comparison phrases, warnings, tradeoffs.
- **[Ingestion pipeline](docs/ingestion-pipeline.md)** — manual entry, CSV, paste
  and URL import; parsing, confidence and source attribution.
- **[Development workflow](docs/workflow.md)** — branches, environments, how a
  change reaches production.

## Environments

| Environment | Branch | URL |
|-------------|--------|-----|
| Production | `main` | https://4n4t5fdmc4-creator.github.io/Bike-Fitting-Tool/ |
| Development | `develop` | https://4n4t5fdmc4-creator.github.io/Bike-Fitting-Tool/dev/ |

Both are rebuilt automatically on every push. See
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Approach in one paragraph

Fit is modelled as **contact-point coordinates relative to the bottom bracket** —
where the saddle and handlebar actually sit — rather than frame stack and reach
alone. Stack and reach remain the shopping layer, because that is what geometry
tables publish and what riders compare. The contact-point layer is what makes it
possible to say *"this frame needs a 90 mm stem and 10 mm of spacers, and that
leaves you room to go lower later."* The saddle reference is the **70 mm
saddle-width point**, not the nose, so the model survives a saddle swap.
