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
├── live_vite.ex              # Main module, ~VUE/~REACT sigils, vue/1 + react/1 components
├── live_vite/components.ex   # <.vue>/<.react> component helpers, auto-discovery
├── live_vite/encoder.ex      # JSON encoding for props
├── live_vite/slots.ex        # Slot interoperability
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

## Release Process

No JS build step required. `package.json` exports point directly to TypeScript source files (`assets/*.ts`). Vite handles TS transpilation when consumers bundle their app.

For hex.pm releases, `mix release.{patch,minor,major}` runs easy_publish (bumps version, updates CHANGELOG, commits, tags, pushes, publishes to Hex).

## Reference Projects

- **React examples**: `/home/andre/Documents/scratch/astro` — Use this Astro project as a reference when you need React component examples or patterns (e.g., for comparing React vs Vue approaches, porting features, or understanding equivalent React implementations).

## Notes

- This is a library - use E2E tests (`npm run e2e:test`) for testing
- CI: Elixir (.github/workflows/elixir.yml), Frontend (.github/workflows/frontend.yml)
