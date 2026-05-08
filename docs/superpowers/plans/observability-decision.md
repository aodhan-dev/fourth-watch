# Observability: Decision Record

**Decision:** Roll logging is gated behind `?debug=1` query parameter and disabled in production by default.

## What is logged

Each `roll()` call emits one `console.info('[fw] roll', payload)` line containing:

- `seed` — reproduce the exact roll via the seed input
- All form inputs (climate, environment, season, time, region, partyLevel, partySize, mode, campfire, noise)
- `digest` — `temp:precip:wind:creature-name-or-no-encounter`

## How to enable

Append `?debug=1` to the page URL (e.g. `https://fourth-watch.pages.dev/?debug=1`). The flag is read once on mount and does not require a page reload to toggle off.

## Cloudflare Pages error reporter (not wired by default)

A Cloudflare Pages Function or Worker can intercept `console.error` calls via the `fetch` handler's `ctx.waitUntil` pattern. To wire it up:

1. Create `functions/api/report-error.ts` that accepts a POST body `{ message, seed, url }`.
2. In `src/lib/observability.ts`, add an `reportError(err, seed)` export that `fetch`es `/api/report-error` when `?debug=1` is active.
3. Keep it behind the same gate so prod console stays clean.

This is not shipped — it is a documented extension point.

## Decision rationale

- Prod console must stay quiet (no noise for end users opening DevTools).
- Support staff can ask users to paste `?debug=1` logs to reproduce a specific roll from the seed.
- Query-string gating requires no build-time config, works on Cloudflare Pages without env var wiring.
