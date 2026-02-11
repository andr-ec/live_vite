# PRD: LiveVite - Multi-Framework Phoenix LiveView Integration

## Overview

Transform the existing `live_vue` library into `live_vite`, a framework-agnostic Phoenix LiveView integration that supports multiple frontend frameworks (starting with Vue and React) in the same project. Inspired by Astro's multi-framework architecture, LiveVite will use a renderer pattern where each framework implements a common interface for mounting, updating, hydrating, and SSR-rendering components. All features currently available for Vue (composables, forms, uploads, streams, SSR, JSON patch diffing) must have React equivalents.

## Goals

- Rename the library from `live_vue` to `live_vite` (new hex.pm package)
- Define a framework-agnostic renderer interface (client + server)
- Implement Vue renderer (extract existing code into the new pattern)
- Implement React renderer with full feature parity
- Support both frameworks coexisting in the same Phoenix project
- Detect framework from file extension (`.vue` → Vue, `.tsx`/`.jsx` → React)
- Provide framework-specific sigils (`~VUE`, `~REACT`) and component helpers
- Adapt all existing tests (unit + E2E) to cover both Vue and React
- Publish as `live_vite` on hex.pm

## Quality Gates

These commands must pass for every user story:
- `mix test` - Elixir tests
- `npm test` - Vitest unit tests
- `npm run e2e:test` - Playwright E2E tests

## User Stories

### US-001: Rename library from live_vue to live_vite

**Description:** As a maintainer, I want to rename all references from `live_vue`/`LiveVue` to `live_vite`/`LiveVite` so the library name reflects its framework-agnostic nature.

**Acceptance Criteria:**
- [ ] Elixir module names changed: `LiveVue` → `LiveVite` throughout `lib/`
- [ ] Mix project name changed to `:live_vite` in `mix.exs`
- [ ] npm package name updated in `package.json`
- [ ] All internal references updated (config keys, hook names, data attributes, etc.)
- [ ] `VueHook` renamed to `LiveViteHook` (or similar generic name)
- [ ] File/directory names updated where appropriate
- [ ] Existing tests pass with the new names

### US-002: Define the framework renderer interface

**Description:** As a developer, I want a clear renderer interface contract so that new frameworks can be added by implementing a standard set of functions.

**Acceptance Criteria:**
- [ ] TypeScript interface defined for client-side renderer: `{ mount, update, destroy, createSSRApp? }`
- [ ] TypeScript interface defined for server-side renderer: `{ check, renderToString }`
- [ ] Interface handles: component mounting, prop updates (including JSON patch), slot rendering, SSR hydration, and cleanup
- [ ] Interface documented with JSDoc comments
- [ ] Elixir-side `Framework` behaviour or protocol defined for framework-specific config (file extensions, sigil, component detection)

### US-003: Extract Vue code into a Vue renderer

**Description:** As a developer, I want existing Vue-specific code extracted into a Vue renderer module that implements the renderer interface, keeping all current functionality intact.

**Acceptance Criteria:**
- [ ] Vue client renderer created (e.g., `assets/renderers/vue/client.ts`) implementing the client interface
- [ ] Vue server renderer created (e.g., `assets/renderers/vue/server.ts`) implementing the server interface
- [ ] Vue composables remain available and work as before (`useLiveVue` → can keep name or alias)
- [ ] All existing Vue E2E tests pass without modification to test logic
- [ ] Vue renderer properly handles: `createApp`, `createSSRApp`, `reactive` props, `h()` slots, `provide/inject` for `$live`

### US-004: Refactor hooks.ts to be framework-agnostic

**Description:** As a developer, I want the Phoenix LiveView hook to delegate to the appropriate framework renderer based on a data attribute, so multiple frameworks work through the same hook.

**Acceptance Criteria:**
- [ ] Hook reads framework identifier from component data attributes (e.g., `data-framework="vue"`)
- [ ] Hook delegates `mounted`, `updated`, `destroyed` lifecycle to the resolved renderer
- [ ] Framework renderers are registered at initialization via `createLiveVite({ renderers: {...} })`
- [ ] JSON patch application remains in the shared hook layer (framework-agnostic)
- [ ] Slot and handler parsing remains in the shared hook layer
- [ ] Prop reactivity/update mechanism is delegated to each renderer

### US-005: Refactor Vite plugin for multi-framework support

**Description:** As a developer, I want the Vite plugin to discover components from multiple frameworks and route SSR requests to the correct renderer.

**Acceptance Criteria:**
- [ ] Plugin discovers `.vue` files and `.tsx`/`.jsx` files from configured directories
- [ ] SSR endpoint (`/ssr_render`) accepts a `framework` parameter and delegates to the correct renderer
- [ ] HMR works for both Vue and React components
- [ ] Plugin composes framework-specific Vite plugins (e.g., `@vitejs/plugin-vue`, `@vitejs/plugin-react`)
- [ ] Plugin exported as `liveVite()` (renamed from `liveVue()`)

### US-006: Update Elixir components module for multi-framework support

**Description:** As a developer, I want the Elixir side to support multiple component helpers and detect frameworks from file extensions.

**Acceptance Criteria:**
- [ ] `LiveVite.Components` generates helpers for both `.vue` and `.tsx`/`.jsx` files
- [ ] `<.vue>` helper works for Vue components, `<.react>` helper works for React components
- [ ] Components pass a `data-framework` attribute to the client hook
- [ ] Framework detection based on file extension is implemented
- [ ] Config option `config :live_vite, frameworks: [:vue, :react]` controls which frameworks are active

### US-007: Implement ~VUE and ~REACT sigils

**Description:** As a developer, I want framework-specific sigils so I can write inline templates with the appropriate syntax.

**Acceptance Criteria:**
- [ ] `~VUE` sigil works as the existing `~VUE` sigil does today
- [ ] `~REACT` sigil added for JSX-style component references
- [ ] Both sigils produce the correct `data-framework` attribute
- [ ] Sigils are importable from `LiveVite`

### US-008: Implement React client renderer

**Description:** As a developer, I want a React client renderer that mounts, updates, and destroys React components within LiveView, with the same capabilities as the Vue renderer.

**Acceptance Criteria:**
- [ ] React components mount via `createRoot` (client) or `hydrateRoot` (SSR)
- [ ] Props are updated efficiently (React re-render triggered on prop changes from JSON patch)
- [ ] Phoenix slots render as React elements via a `StaticHtml` wrapper component (similar to Astro pattern)
- [ ] Component properly unmounts on `destroyed` lifecycle
- [ ] Works with both functional and class components (functional prioritized)

### US-009: Implement React server renderer (SSR)

**Description:** As a developer, I want React components to be server-side rendered through the same SSR pipeline as Vue components.

**Acceptance Criteria:**
- [ ] `renderToString` from `react-dom/server` used for SSR
- [ ] SSR output includes preload links for React chunks
- [ ] `check()` function correctly identifies React components
- [ ] Works with both NodeJS and ViteJS SSR modes
- [ ] SSR hydration works without mismatch warnings

### US-010: Implement React useLive hook (equivalent to useLiveVue)

**Description:** As a React developer, I want a `useLive()` hook that gives me access to `pushEvent`, `handleEvent`, and current props, mirroring `useLiveVue()`.

**Acceptance Criteria:**
- [ ] `useLive()` hook provides `pushEvent(event, payload, callback?)`
- [ ] `useLive()` hook provides `handleEvent(event, callback)` with auto-cleanup
- [ ] `$live` context provided via React Context (not Vue's provide/inject)
- [ ] Hook properly types with TypeScript generics for props

### US-011: Implement React useLiveEvent hook

**Description:** As a React developer, I want `useLiveEvent(name, handler)` to subscribe to server-pushed events with automatic cleanup.

**Acceptance Criteria:**
- [ ] `useLiveEvent(eventName, callback)` subscribes to LiveView events
- [ ] Listener is cleaned up on component unmount via `useEffect` cleanup
- [ ] Callback reference is stable (latest callback pattern)
- [ ] Works identically to Vue's `useLiveEvent`

### US-012: Implement React useLiveNavigation hook

**Description:** As a React developer, I want `useLiveNavigation()` to provide `patch()` and `navigate()` for LiveView navigation.

**Acceptance Criteria:**
- [ ] `patch(url, opts?)` triggers `live_patch`
- [ ] `navigate(url, opts?)` triggers `live_redirect`
- [ ] API mirrors the Vue composable

### US-013: Implement React useLiveForm hook

**Description:** As a React developer, I want `useLiveForm()` to integrate with Ecto changesets for server-side form validation, mirroring the Vue composable.

**Acceptance Criteria:**
- [ ] `useLiveForm(form, options)` returns `{ field, fieldArray, submit }`
- [ ] `field(path)` returns `{ value, error, inputAttrs, isValid, isDirty }` etc.
- [ ] `fieldArray(path)` returns `{ items, add, remove, move }` etc.
- [ ] Debounced change events sent to server for validation
- [ ] Nested form support (embeds_one, embeds_many)
- [ ] Works with Phoenix.HTML.Form encoded data

### US-014: Implement React useLiveUpload hook

**Description:** As a React developer, I want `useLiveUpload()` to integrate with Phoenix LiveView uploads.

**Acceptance Criteria:**
- [ ] `useLiveUpload(uploadConfig, options)` provides file picker, drag-and-drop, and upload lifecycle
- [ ] Supports `showFilePicker()`, `addFiles()`, `cancel(ref)`
- [ ] Integrates with Phoenix upload channel
- [ ] API mirrors the Vue composable

### US-015: Add React E2E tests for basic features

**Description:** As a maintainer, I want E2E tests for React covering the same basic scenarios as existing Vue tests (mounting, prop updates, events, SSR).

**Acceptance Criteria:**
- [ ] `test/e2e/features/basic-react/` with LiveView, React component, and Playwright spec
- [ ] Tests cover: component mounting, prop reactivity, pushEvent, handleEvent, SSR hydration
- [ ] Tests follow the same colocated pattern as Vue tests
- [ ] Route added to test router

### US-016: Add React E2E tests for forms

**Description:** As a maintainer, I want E2E tests for React form integration with Ecto changesets.

**Acceptance Criteria:**
- [ ] `test/e2e/features/form-react/` with LiveView, React form component, and Playwright spec
- [ ] Tests cover: field binding, validation errors, nested forms, array fields, submit
- [ ] Mirrors existing Vue form E2E tests

### US-017: Add React E2E tests for streams and advanced features

**Description:** As a maintainer, I want E2E tests for React covering streams, uploads, navigation, and slots.

**Acceptance Criteria:**
- [ ] React E2E tests for LiveView streams (insert, delete, reset, limit)
- [ ] React E2E tests for file uploads
- [ ] React E2E tests for live navigation (patch, navigate)
- [ ] React E2E tests for slot rendering
- [ ] Mirrors existing Vue E2E tests for these features

### US-018: Update documentation and package metadata

**Description:** As a user, I want updated README, hex.pm description, and package.json so I can understand how to use LiveVite with both Vue and React.

**Acceptance Criteria:**
- [ ] README reflects the new multi-framework capability
- [ ] Installation instructions cover adding Vue, React, or both
- [ ] Configuration examples for `config :live_vite, frameworks: [:vue, :react]`
- [ ] Composable/hook API documented for both frameworks
- [ ] hex.pm metadata (description, links) updated for `live_vite`

## Functional Requirements

- FR-1: The system must detect component framework from file extension (`.vue` → Vue, `.tsx`/`.jsx` → React)
- FR-2: Multiple frameworks must coexist in the same Phoenix project without conflicts
- FR-3: Each framework renderer must support: mounting, prop updates via JSON patch, slot rendering, SSR, and cleanup
- FR-4: The Elixir config `config :live_vite, frameworks: [:vue, :react]` must control which frameworks are available
- FR-5: SSR must work for both frameworks through the same SSR mode (NodeJS or ViteJS)
- FR-6: The Vite plugin must compose framework-specific plugins and handle HMR for all configured frameworks
- FR-7: All React hooks must provide equivalent functionality to their Vue composable counterparts
- FR-8: JSON patch diffing must work identically for both frameworks (shared layer)
- FR-9: Phoenix slots must render correctly in both Vue and React components
- FR-10: LiveView streams must work with both frameworks

## Non-Goals

- Support for frameworks beyond Vue and React in this iteration (Svelte, Solid, etc.)
- Astro-style island architecture with multiple hydration strategies (load, idle, visible)
- Mixing frameworks within a single component (Vue inside React or vice versa)
- Backward compatibility with the `live_vue` hex package (this is a new package)
- Custom hydration directives
- Per-framework SSR mode configuration

## Technical Considerations

- **Renderer pattern**: Inspired by Astro's `{ check, renderToStaticMarkup }` server interface and `(element) => (Component, props, slots) => void` client interface, adapted for LiveView's `mounted/updated/destroyed` lifecycle
- **React reactivity**: Unlike Vue's `reactive()`, React requires re-rendering via `setState`. The React renderer will need to wrap props in a state container and trigger re-renders on JSON patch application
- **React Context vs Vue provide/inject**: The `$live` instance will be provided via `React.createContext` in the React renderer
- **Shared code**: `jsonPatch.ts`, prop/slot/handler parsing, and the hook lifecycle orchestration remain framework-agnostic
- **Dependencies**: React renderer will require `react`, `react-dom` as peer dependencies; Vue renderer keeps `vue` as peer dependency
- **Bundle size**: Renderers should be tree-shakeable so users only pay for frameworks they use
- **E2E test infrastructure**: The test Phoenix server and router need to support both `.vue` and `.tsx` component discovery

## Success Metrics

- All existing Vue functionality works identically under the new `live_vite` name
- React has full feature parity with Vue (composables, forms, uploads, streams, SSR, slots)
- Both frameworks can be used in the same Phoenix project simultaneously
- All E2E tests pass for both Vue and React
- Library is publishable to hex.pm as `live_vite`

## Open Questions

- Should there be a migration guide or codemod for existing `live_vue` users?
- Should React components support both `.tsx` and `.jsx`, or `.tsx` only?
- How should shared state between Vue and React components be handled (if at all)?
- Should the library re-export framework-specific types for better DX?
