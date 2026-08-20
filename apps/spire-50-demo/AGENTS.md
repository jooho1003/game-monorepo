# Spire 50 Agent Guide

## Scope

This directory owns the `spire-50-demo` web game. Keep engine-independent rules in
`src/domain`, React document-style UI in `src/app`, and Phaser rendering/input in
`src/game`.

## Required commands

Run these from the monorepo root before a milestone commit:

```bash
pnpm --filter=spire-50-demo typecheck
pnpm --filter=spire-50-demo test
pnpm --filter=spire-50-demo build
```

For local play:

```bash
pnpm --filter=spire-50-demo dev
```

## Architecture rules

- `src/domain` is the authority for run state, deterministic choices, resources,
  and serialized commands. It must not import React or Phaser.
- Zustand exposes the latest domain snapshot and a bounded event/command history.
- React owns title, loadout, dialogue, HUD, shop, and result overlays.
- Phaser owns world rendering, pointer/keyboard input, camera, and temporary P0
  combat actors. Move combat resolution into `src/domain` as P1 matures.
- Never use `Math.random()` for gameplay. Derive choices from the run seed.
- Validate persisted data with Zod and keep `saveVersion` explicit.
- Unsubscribe listeners and destroy Phaser instances on React unmount.

## Code conventions

- TypeScript strict mode is mandatory. Avoid `any` and unsafe casts.
- Prefer small modules and named domain types over stringly typed state.
- React components subscribe to narrow Zustand selectors.
- Do not mirror a domain value in React local state unless it is transient UI state.
- Korean is the only player-facing language during the demo phase.
- Keep canvas-relative controls usable at 1280×720 and scaled 16:9 layouts.

## Assets and rights

- Reference screenshots are design references, not shippable game assets.
- Record every imported/generated asset in `public/assets/README.md`.
- Kenney game assets may be used under CC0, but keep the source URL.
- Do not ship AetherAI assets without a captured per-file license.
- Record model, prompt, date, and edits for generated assets.
- Do not reproduce third-party logos, named characters, maps, or UI verbatim.

## Git hygiene

- Stage only files required for the current checkpoint.
- Do not include reference screenshots in production asset commits.
- Use Conventional Commits with the `spire-50` scope.
- A milestone commit must leave typecheck, tests, and build green.
