# Aquarium test setup

This patch configures Vitest for web and API, React Testing Library and jsdom for web,
and unit tests in GitHub Actions. The included tests are initial infrastructure smoke tests,
not tests of the aquarium application's real features.

## Install dependencies and update lockfile

From the repository root:

```bash
pnpm --filter @aquarium/web add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
pnpm --filter @aquarium/api add -D vitest @vitest/coverage-v8
```

The `pnpm add` commands update package manifests and pnpm-lock.yaml. Do not use
`--frozen-lockfile` until after installing.

## Run

```bash
pnpm test
pnpm test:coverage
pnpm --filter @aquarium/web build
pnpm --filter @aquarium/api typecheck
pnpm exec prettier --write package.json apps/web/package.json apps/api/package.json apps/web/vite.config.ts apps/web/vitest.config.ts apps/api/vitest.config.ts apps/web/src/test apps/api/src/test .github/workflows/ci.yml
pnpm exec prettier --check .
```

CI runs `pnpm test` after generating the Prisma client. Do not commit until all checks pass.
