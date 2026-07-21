# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets). Every change
that affects the published package should ship with a changeset describing the bump.

Add one with:

```bash
npm run changeset
```

Pick the semver bump (patch / minor / major) and write a short, user-facing summary. Commit the
generated `.changeset/*.md` file alongside your change. See
[`../CONTRIBUTING.md`](../CONTRIBUTING.md#releases-changesets) for the full flow.
