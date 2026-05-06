# Gary's D&D Encounter & Weather Tool

Static SvelteKit web app that rolls weighted weather and random encounters for D&D 5e.

## Local development

```
npm install
npm run dev
```

## Refresh monster snapshot

```
npm run fetch:monsters
```

## Build

```
npm run build
```

Output goes to `build/`.

## Tests

```
npm test
```

## Deploy

The repo is set up to auto-deploy via Cloudflare Pages on push to `main`.
To connect:

1. Push the repo to GitHub.
2. In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git.
3. Build settings:
   - Framework preset: SvelteKit
   - Build command: `npm run build`
   - Build output directory: `build`
   - Environment variable: `NODE_VERSION=20`

## Attribution

Monster data: [Open5e](https://open5e.com/) (SRD only).
This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC,
used under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
