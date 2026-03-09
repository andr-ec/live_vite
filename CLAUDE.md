# LiveVite Library Development

Vue.js + React + Phoenix LiveView integration library. Version 1.0.0.

> This is a living document. Claude sessions should update it with brief learnings as they arise. For detailed notes, see [docs/LEARNINGS.md](docs/LEARNINGS.md).

## Quick Reference

```bash
# Tests
mix test                          # Elixir tests
npm test                          # Vitest (assets/*.test.ts)
npm run e2e:test                  # Playwright E2E (test/e2e/)

# Setup
mix setup                         # First-time setup (deps + npm install)
```

## Project Structure

```
lib/
├── live_vite.ex              # Main module, ~VUE/~REACT sigils, vue/1 + react/1 + component/1
├── live_vite/components.ex   # <.vue>/<.react> component helpers, auto-discovery via plugin registry
├── live_vite/encoder.ex      # JSON encoding for props
├── live_vite/slots.ex        # Slot interoperability
├── live_vite/plugin.ex       # Plugin behaviour (name, file_extensions, render_fn)
├── live_vite/plugin/
│   ├── vue.ex                # Vue plugin (.vue files)
│   ├── react.ex              # React plugin (.tsx/.jsx files)
│   └── registry.ex           # Plugin registry, framework detection
└── live_vite/ssr/            # SSR: NodeJS and ViteJS modes
assets/
├── index.ts                 # Main entry, exports all Vue + React APIs
├── hooks.ts                 # Phoenix LiveView hooks (getMultiRendererHook, getRendererHook)
├── renderer.ts              # FrameworkRenderer interface
├── renderers/vue.ts         # Vue renderer implementation
├── renderers/react.ts       # React renderer implementation
├── use.ts                   # Vue composables (useLiveEvent, etc.)
├── useReact.ts              # React hooks (useLive, useLiveEvent, useLiveNavigation)
├── useLiveForm.ts           # Vue form handling with Ecto changesets
├── useLiveFormReact.ts      # React form handling with Ecto changesets
├── useLiveUploadReact.ts    # React file upload hook
├── jsonPatch.ts             # Efficient prop diffing (framework-agnostic)
├── server.ts                # SSR: getRendererRender, getMultiRendererRender
└── vitePlugin.js            # Vite plugin for component discovery
test/e2e/                    # Playwright E2E tests with Phoenix server
```

## Key Patterns

### Component Usage (Elixir)

```elixir
# Vue component
<.vue count={@count} v-component="Counter" v-socket={@socket} />

# React component
<.react count={@count} v-component="Counter" v-socket={@socket} />

# Auto-detect framework from file extension
<.component count={@count} v-component="Counter" v-socket={@socket} />

# Or with sigils
~VUE"""<Counter :count="count" />"""
~REACT"""export default function Counter({ count }) { return <div>{count}</div> }"""
```

### Vue Composables (TypeScript)

- `useLiveVite()` - Access to `$live.pushEvent()`, props
- `useLiveEvent(name, handler)` - LiveView event subscription
- `useLiveNavigation()` - `patch()` and `navigate()` helpers
- `useLiveForm(formName)` - Server-side validation with Ecto
- `useLiveUpload(uploadName)` - File upload integration

### React Hooks (TypeScript)

- `useLive()` - Access to hook instance (mirrors `useLiveVite()`)
- `useLiveEventReact(name, handler)` - LiveView event subscription
- `useLiveNavigationReact()` - `patch()` and `navigate()` helpers
- `useLiveFormReact(form, options)` - Server-side validation with Ecto
- `useLiveUploadReact(uploadName)` - File upload integration

### SSR Modes

- `LiveVite.SSR.NodeJS` - Node.js subprocess (default)
- `LiveVite.SSR.ViteJS` - HTTP to Vite dev server (dev mode)

## E2E Testing

Colocated feature structure in `test/e2e/features/`:

```
test/e2e/features/
├── basic/            # Each feature is a directory
│   ├── live.ex       # LiveView module
│   ├── counter.vue   # Vue component(s)
│   └── basic.spec.js # Playwright test
├── form/
├── stream/
└── ...
```

To add a new E2E test:

1. Create `test/e2e/features/my-feature/`
2. Add `live.ex` (LiveView), `*.vue`/`*.tsx` (components), `*.spec.js` (test)
3. Add route to `test/e2e/test_helper.exs` router

Key utilities in `test/e2e/utils.js`:

- `syncLV(page)` - Wait for LiveView connection
- `evalLV(page, code)` - Execute Elixir in LiveView process

## Conventions

Commit format: `type: description` (feat/fix/docs/test/refactor/chore)

## Package Exports (Subpath Imports)

The npm package provides subpath exports for tree-shaking. This is critical for multi-framework setups to avoid loading React on Vue-only pages and vice versa:

| Import path                 | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `live_vite`                 | Barrel — everything (loads both frameworks) |
| `live_vite/renderers/vue`   | Vue renderer only (no React dependency)     |
| `live_vite/renderers/react` | React renderer only (no Vue dependency)     |
| `live_vite/hooks`           | `getMultiRendererHook`, `getRendererHook`   |
| `live_vite/utils`           | `findComponent` and utilities               |
| `live_vite/renderer`        | `FrameworkRenderer` interface and types     |
| `live_vite/server`          | SSR render functions                        |
| `live_vite/vitePlugin`      | Vite plugin for SSR and HMR                 |

For multi-framework projects, consumers must exclude `live_vite` from Vite's `optimizeDeps` so subpath imports resolve independently, and include React packages in `ssr.optimizeDeps.include` for SSR to work.

## Release Process

No JS build step required. `package.json` exports point directly to TypeScript source files (`assets/*.ts`). Vite handles TS transpilation when consumers bundle their app.

For hex.pm releases, `mix release.{patch,minor,major}` runs easy_publish (bumps version, updates CHANGELOG, commits, tags, pushes, publishes to Hex).

## Reference Projects

- **React examples**: `/home/andre/Documents/scratch/astro` — Use this Astro project as a reference when you need React component examples or patterns (e.g., for comparing React vs Vue approaches, porting features, or understanding equivalent React implementations).

## Notes

- This is a library - use E2E tests (`npm run e2e:test`) for testing
- CI: Elixir (.github/workflows/elixir.yml), Frontend (.github/workflows/frontend.yml)
