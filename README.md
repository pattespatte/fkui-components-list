# FKUI Components List

Generates an HTML page listing all [FKUI](https://github.com/Forsakringskassan/designsystem) ([Försäkringskassan design system](https://designsystem.forsakringskassan.se/latest/)) components with breakpoint counts and Vue Playground links.

## Quick Start

```bash
npm install
npm run generate
open dist/index.html
```

## What It Does

- Scans `@fkui/design` SCSS source for breakpoint mixin usage per component
- Lists all 54 Vue components and 9 SCSS-only components
- Generates Vue Playground URLs for each component (click to see it rendered live)
- Outputs `dist/index.html`

## Regenerate

```bash
npm run generate
```

## Output

`dist/index.html` — self-contained HTML page with:
- Component table (name, SCSS mapping, breakpoint count, playground link)
- Stats summary (total components, responsive count)
- FKUI styling loaded from CDN

## Tech

- `@fkui/vue` + `@fkui/design` as dependencies (version-pinned)
- `lz-string` for Vue Playground URL compression
- Zero build step — just `node src/generate.mjs`
