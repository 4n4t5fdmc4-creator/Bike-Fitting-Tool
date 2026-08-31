# Development Workflow

This repository keeps two permanent lines of work. The point is that experiments
can never break the version other people see.

## The two branches

A **branch** is an independent copy of the project's files. Work on one branch
does not affect the other until the two are explicitly merged.

| Branch | Role | Published to |
|--------|------|--------------|
| `main` | Production. Always in a state that can be shown to anyone. | `/` |
| `develop` | Development. Work in progress, may be broken. | `/dev/` |

Both branches are deployed automatically. A push to either one rebuilds the whole
site, so the production URL and the development URL always reflect the current
state of their respective branches.

## The normal cycle

```
develop  ──o──o──o──────────────►   (work happens here, /dev/ updates live)
                   \
main     ───────────●───────────►   (merge when it is good, / updates live)
```

1. Make changes on `develop`.
2. Check the result at `/dev/`.
3. When it is good, merge `develop` into `main` via a pull request.
4. Production updates automatically.

## What a pull request is

A **pull request** (PR) is a proposal to merge one branch into another. It is not
a technical necessity — branches can be merged directly — but it creates a place
where the change can be reviewed before it becomes production:

- a side-by-side view of every line that would change,
- a description of *why*,
- automated checks that must pass,
- a permanent record of the decision, linked to the resulting commits.

For a solo project the value is mostly the second and fourth points: six months
later, the PR explains why something was done. Merging `develop` into `main`
without one is a legitimate choice for small changes.

## Creating a pull request

On github.com: open the repository, select `develop`, click **Contribute** →
**Open pull request**, set the base branch to `main`, write what changed, then
**Create**. Merging it triggers the production deployment.

From the command line:

```bash
gh pr create --base main --head develop --title "..." --body "..."
gh pr merge --merge
```

## Working entirely in the browser

No local checkout is required.

| Task | Where |
|------|-------|
| Edit one file | Open it on github.com, click the pencil icon |
| Edit several files | Press `.` in the repository to open the web editor |
| Full development environment | **Code** → **Codespaces** → **Create codespace** |

When editing on github.com, the commit dialog offers a target branch. Choose
`develop` unless the change is trivial.

## Deployment

Defined in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). One
GitHub Pages site holds both environments: `main` at the root, `develop` nested at
`/dev/`. The development build carries a visible banner and is excluded from
search engines via `robots.txt`.

Build status is visible under the repository's **Actions** tab. A failed
deployment leaves the previously published site untouched.
