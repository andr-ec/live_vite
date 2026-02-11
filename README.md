<div align="center">
    <img src="https://github.com/Valian/live_vite/blob/main/live_vite_logo_rounded.png?raw=true" alt="Description" height="256px">
<br>
<a href="https://hex.pm/packages/live_vite"><img src="https://img.shields.io/hexpm/v/live_vite.svg" alt="Hex.pm"></a>
<a href="https://hexdocs.pm/live_vite"><img src="https://img.shields.io/badge/docs-hexdocs.pm-purple" alt="Hexdocs.pm"></a>
<a href="https://github.com/Valian/live_vite"><img src="https://img.shields.io/github/stars/Valian/live_vite?style=social" alt="GitHub"></a>
<br><br>
Vue and React inside Phoenix LiveView with seamless end-to-end reactivity.
</div>

## Features

-   ⚡ **End-To-End Reactivity** with LiveView
-   🧙‍♂️ **One-line Install** - Automated setup via Igniter installer
-   🔋 **Server-Side Rendered** (SSR) Vue and React
-   🐌 **Lazy-loading** Components
-   📦 **Efficient Props Diffing** - Only changed data is sent over WebSocket
-   🪄 **~VUE and ~REACT Sigils** as alternative LiveView DSLs
-   🎯 **Phoenix Streams** Support with efficient patches
-   🦄 **Tailwind** Support
-   🦥 **Slot Interoperability**
-   📁 **File Upload Hooks** - `useLiveUpload()` (Vue) and `useLiveUploadReact()` (React)
-   📝 **Comprehensive Form Handling** - `useLiveForm()` (Vue) and `useLiveFormReact()` (React) with server-side validation via Ecto changesets
-   🔌 **Multi-Framework** - Use Vue and React components in the same project
-   🚀 **Amazing DX** with Vite


## Resources

-   [Live Examples](https://livevue.skalecki.dev) - Interactive demos
-   [HexDocs](https://hexdocs.pm/live_vite)
-   [HexPackage](https://hex.pm/packages/live_vite)
-   [Phoenix LiveView](https://github.com/phoenixframework/phoenix_live_view)

## Example

After installation, you can use Vue or React components in the same way as functional LiveView components. All the `phx-click`, `phx-change` attributes work inside components as well.

### Vue

```html
<script setup lang="ts">
import {ref} from "vue"

const props = defineProps<{count: number}>()
const diff = ref(1)
</script>

<template>
  Current count: {{ props.count }}
  <input v-model.number="diff" type="range" min="1" max="10" />
  <button phx-click="inc" :phx-value-diff="diff">
    Increase counter by {{ diff }}
  </button>
</template>
```

```elixir
defmodule MyAppWeb.CounterLive do
  use MyAppWeb, :live_view

  def render(assigns) do
    ~H"""
    <.vue count={@count} v-component="Counter" v-socket={@socket} />
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, count: 0)}
  end

  def handle_event("inc", %{"diff" => value}, socket) do
    {:noreply, update(socket, :count, &(&1 + value))}
  end
end
```

### React

```tsx
import { useState } from "react"

export default function Counter({ count }: { count: number }) {
  const [diff, setDiff] = useState(1)

  return (
    <div>
      Current count: {count}
      <input type="range" min="1" max="10" value={diff}
        onChange={e => setDiff(Number(e.target.value))} />
      <button phx-click="inc" phx-value-diff={diff}>
        Increase counter by {diff}
      </button>
    </div>
  )
}
```

```elixir
defmodule MyAppWeb.CounterLive do
  use MyAppWeb, :live_view

  def render(assigns) do
    ~H"""
    <.react count={@count} v-component="Counter" v-socket={@socket} />
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, count: 0)}
  end

  def handle_event("inc", %{"diff" => value}, socket) do
    {:noreply, update(socket, :count, &(&1 + value))}
  end
end
```

## Why?

Phoenix LiveView makes it possible to create rich, interactive web apps without writing JS.

But once you need to do anything slightly complex on the client-side, you'll end up writing lots of imperative, hard-to-maintain hooks.

LiveVite lets you create hybrid apps where part of the session state is on the server and part on the client, using your favorite frontend framework.

### Reasons why you'd like to use LiveVite

-   Your hooks are starting to look like jQuery
-   You have complex local state
-   You'd like to use the massive Vue or React ecosystem
-   You want transitions, graphs, rich components etc.
-   You can use Vue, React, or both in the same project

## Installation

**New project:**
```bash
mix archive.install hex igniter_new
mix igniter.new my_app --with phx.new --install live_vite
```

**Existing project (Phoenix 1.8+ only):**
```bash
mix igniter.install live_vite
```

Igniter installer works only for Phoenix 1.8+ projects. For detailed installation instructions, see the [Installation Guide](guides/installation.md).

## VS Code Extension

For syntax highlighting of the `~VUE` and `~REACT` sigils:
- **VS Code Marketplace**: Install [LiveVite](https://marketplace.visualstudio.com/items?itemName=guilhermepsf23.livevite-sigil-highlighting) extension
- **Manual Installation**: Download VSIX from [releases](https://github.com/GuilhermePSF/live-vite-sigil-highlighting/releases) and install via `Extensions > Install from VSIX...`

## Guides

### Getting Started
 - [Getting Started](guides/getting_started.md) - Create your first component with transitions

### Core Usage
 - [Basic Usage](guides/basic_usage.md) - Fundamental patterns, ~VUE/~REACT sigils, and common examples
 - [Forms and Validation](guides/forms.md) - Complex forms with server-side validation using useLiveForm
 - [Configuration](guides/configuration.md) - Advanced setup, SSR, and customization options

### Reference
 - [Component Reference](guides/component_reference.md) - Complete syntax documentation
 - [Client-Side API](guides/client_api.md) - Vue composables, React hooks, and utilities

### Advanced Topics
 - [Architecture](guides/architecture.md) - How LiveVite works under the hood
 - [Testing](guides/testing.md) - Testing Vue components in LiveView
 - [Deployment](guides/deployment.md) - Production deployment guide

### Help & Troubleshooting
 - [FAQ](guides/faq.md) - Common questions and comparisons
 - [Troubleshooting](guides/troubleshooting.md) - Debug common issues
 - [Comparison](guides/comparison.md) - LiveVite vs other solutions

## Relation to LiveSvelte

This project is heavily inspired by ✨ [LiveSvelte](https://github.com/woutdp/live_svelte) ✨. Both projects try to solve the same problem. LiveVite was started as a fork of LiveSvelte with adjusted ESbuild settings, and evolved to use Vite and a slightly different syntax. I strongly believe more options are always better, and since I love Vue and it's ecosystem I've decided to give it a go 😉

You can read more about differences between Vue and Svelte [in FAQ](guides/faq.md#how-does-livevite-compare-to-livesvelte) or [in comparison guide](guides/comparison.md).

## LiveVite Development

### Local Setup

Ensure you have Node.js installed. Clone the repo and run `mix setup`.

No build step is required for the library itself - Vite handles TypeScript transpilation when consumers bundle their app.

Use `npm run e2e:test` to run the Playwright E2E tests.

### Testing Local Changes in Another Project

To test local LiveVite changes in a separate Phoenix project, use a path dependency in your project's `mix.exs`:

```elixir
{:live_vite, path: "../live_vite"}
```

Then run `mix deps.get && npm install`. The installer already configures `package.json` to use `file:./deps/live_vite`, so both Elixir and npm will point to your local copy.

Elixir changes are reflected immediately. For TypeScript changes, run `npm install` again to pick them up.

### Multi-Framework Setup

LiveVite supports Vue, React, or both in the same project. On the client side, register renderers for each framework:

```typescript
import { getMultiRendererHook, createVueRenderer, createReactRenderer, findComponent } from "live_vite"

const vueComponents = import.meta.glob("./**/*.vue")
const reactComponents = import.meta.glob("./**/*.{tsx,jsx}")

const hooks = {
  VueHook: getMultiRendererHook({
    vue: {
      renderer: createVueRenderer(),
      resolve: name => findComponent(vueComponents, name),
    },
    react: {
      renderer: createReactRenderer(),
      resolve: name => findComponent(reactComponents, name),
    },
  }),
}
```

On the server side, use `<.vue>` for Vue components and `<.react>` for React components:

```elixir
<.vue v-component="Counter" count={@count} v-socket={@socket} />
<.react v-component="Dashboard" data={@data} v-socket={@socket} />
```

### Releasing

Release is done with `expublish` package.

-   Write version changelog in untracked `RELEASE.md` file
-   Update version in `INSTALLATION.md`

Run

```bash
git add INSTALLATION.md
git commit -m "INSTALLATION version bump"

# to ensure everything works fine
mix expublish.minor --dry-run --allow-untracked --branch=main

# to publish
mix expublish.minor --allow-untracked --branch=main
```

## Features Implemented 🎯

- [x] `useLiveEvent` - automatically attaching & detaching [`handleEvent`](https://hexdocs.pm/phoenix_live_view/js-interop.html#client-hooks-via-phx-hook)
- [x] JSON Patch diffing - send only changed props over the WebSocket
- [x] VS Code extension - syntax highlighting for `~VUE` sigil
- [x] Igniter installer - one-line installation for Phoenix 1.8+ projects
- [x] `useEventReply` - easy handling of `{:reply, data, socket}` responses
- [x] `useLiveForm` - Ecto changesets & server-side validation
- [x] Phoenix Streams - full support for `stream()` operations
- [x] **React support** - `createReactRenderer`, `useLive`, `useLiveFormReact`, `useLiveUploadReact`
- [x] **Multi-framework** - use Vue and React in the same project via `getMultiRendererHook`
- [x] `~REACT` sigil - inline React (TSX) components in LiveView

## Credits

[LiveSvelte](https://github.com/woutdp/live_svelte)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Valian/live_vite&type=Date)](https://star-history.com/#Valian/live_vite&Date)
