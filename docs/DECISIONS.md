# Decisions

Short ADR-style log. Newest at the bottom.

## TypeScript pinned to 6.0.x

`typescript-eslint` 8.x supports TypeScript `<6.1`. TypeScript 7 (native) is out, but linting would
run on an unsupported version. Revisit when typescript-eslint supports 7.

## pnpm via Corepack

`packageManager` pins pnpm in `package.json`. Run `corepack enable` once so `pnpm` is on PATH.
`esbuild` is the only dependency allowed to run install scripts (`allowBuilds` in
`pnpm-workspace.yaml`).

## No SQLite until the live adapter

Fixtures are local files and need no cache. `better-sqlite3` (native build) lands with the live
Riot client, where caching actually matters.
