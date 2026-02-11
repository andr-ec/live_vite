import { createElement } from "react"
import { createRoot, hydrateRoot, type Root } from "react-dom/client"
import type { FrameworkRenderer, MountContext, RendererState } from "../renderer.js"
import { applyPatch, type Operation } from "../jsonPatch.js"
import { mapValues } from "../utils.js"
import { LiveContext } from "../useReact.js"

/**
 * State specific to the React renderer.
 * We store the component and hook alongside the root so we can
 * re-render the full tree on every prop/slot update.
 */
interface ReactRendererState {
  root: Root
  component: unknown
  hook: any
}

/**
 * Convert slot name -> HTML string into React elements.
 * Each slot renders as a span with dangerouslySetInnerHTML.
 */
function htmlSlotsToReact(slots: Record<string, string>): Record<string, () => any> {
  return mapValues(slots, html => () =>
    createElement("span", { dangerouslySetInnerHTML: { __html: html.trim() } })
  )
}

/**
 * Re-render the React component tree with current props and slots.
 * Wraps the component in LiveContext.Provider so useLive()/useLiveEvent() work.
 */
function renderComponent(state: RendererState<ReactRendererState>): void {
  const { root, component, hook } = state.app!
  const inner = createElement(component as any, {
    ...state.props,
    ...mapValues(state.slots, slotFn => slotFn()),
    live: hook,
  })
  root.render(createElement(LiveContext.Provider, { value: hook }, inner))
}

export interface ReactRendererOptions {
  /** Vite SSR manifest for preload link generation (production builds only). */
  manifest?: Record<string, string[]>
}

/**
 * Creates a React framework renderer.
 *
 * Implements the `FrameworkRenderer` interface for React 18+.
 * Uses `createRoot`/`hydrateRoot` for mounting and re-renders the full
 * component tree on every prop/slot update via `root.render()`.
 *
 * Props are stored as a plain mutable object. Since React has no built-in
 * reactivity system, updates trigger an explicit re-render call.
 *
 * Slots are passed as React elements via `dangerouslySetInnerHTML`.
 */
type SSRManifest = Record<string, string[]>

function renderPreloadLinks(modules: string[], manifest: SSRManifest) {
  let links = ""
  const seen = new Set()
  modules.forEach((id: string) => {
    const files = manifest[id]
    if (files) {
      files.forEach(file => {
        if (!seen.has(file)) {
          seen.add(file)
          const filename = file.split("/").pop() ?? file
          if (manifest[filename]) {
            for (const depFile of manifest[filename]) {
              links += renderPreloadLink(depFile)
              seen.add(depFile)
            }
          }
          links += renderPreloadLink(file)
        }
      })
    }
  })
  return links
}

function renderPreloadLink(file: string) {
  if (file.endsWith(".js")) {
    return `<link rel="modulepreload" crossorigin href="${file}">`
  } else if (file.endsWith(".css")) {
    return `<link rel="stylesheet" href="${file}">`
  } else if (file.endsWith(".woff")) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`
  } else if (file.endsWith(".woff2")) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`
  } else if (file.endsWith(".gif")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/gif">`
  } else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/jpeg">`
  } else if (file.endsWith(".png")) {
    return ` <link rel="preload" href="${file}" as="image" type="image/png">`
  } else {
    return ""
  }
}

/**
 * Find manifest entries matching the component name.
 * Searches manifest keys for paths containing the component name with
 * React-typical extensions (.tsx, .jsx, .ts, .js).
 */
function findManifestModules(name: string, manifest: SSRManifest): string[] {
  const extensions = [".tsx", ".jsx", ".ts", ".js"]
  return Object.keys(manifest).filter(key =>
    extensions.some(ext => key.endsWith(`/${name}${ext}`) || key.endsWith(`/${name}/index${ext}`) || key === `${name}${ext}`)
  )
}

export function createReactRenderer(options: ReactRendererOptions = {}): FrameworkRenderer<ReactRendererState> {
  return {
    name: "react",

    mount(ctx: MountContext): RendererState<ReactRendererState> {
      const props = { ...ctx.props }
      const slots = htmlSlotsToReact(ctx.slots)

      const inner = createElement(ctx.component as any, {
        ...props,
        ...mapValues(slots, slotFn => slotFn()),
        live: ctx.hook,
      })
      const element = createElement(LiveContext.Provider, { value: ctx.hook }, inner)

      let root: Root
      if (ctx.ssr) {
        root = hydrateRoot(ctx.el, element)
      } else {
        root = createRoot(ctx.el)
        root.render(element)
      }

      const state: RendererState<ReactRendererState> = {
        props,
        slots,
        app: { root, component: ctx.component, hook: ctx.hook },
      }

      return state
    },

    updateProps(state: RendererState<ReactRendererState>, newProps: Record<string, any>): void {
      Object.assign(state.props, newProps)
      renderComponent(state)
    },

    patchProps(state: RendererState<ReactRendererState>, operations: Operation[]): void {
      applyPatch(state.props, operations)
      // JSON Patch mutates objects in-place, but React needs new references
      // to detect changes in hooks (useEffect, useMemo, etc.).
      // Deep-clone the affected props so React sees fresh references.
      state.props = JSON.parse(JSON.stringify(state.props))
      renderComponent(state)
    },

    updateSlots(state: RendererState<ReactRendererState>, newSlots: Record<string, string>): void {
      Object.assign(state.slots, htmlSlotsToReact(newSlots))
      renderComponent(state)
    },

    unmount(state: RendererState<ReactRendererState>): void {
      if (state.app) {
        window.addEventListener("phx:page-loading-stop", () => state.app!.root.unmount(), { once: true })
      }
    },

    async renderToString(ctx): Promise<string> {
      const { renderToString: reactRenderToString } = await import("react-dom/server")
      const manifest = options.manifest ?? {}

      const slotElements = mapValues(htmlSlotsToReact(ctx.slots), slotFn => slotFn())
      const element = createElement(ctx.component as any, {
        ...ctx.props,
        ...slotElements,
      })

      const html = reactRenderToString(element)

      // Generate preload links from manifest if component name is available
      const modules = ctx.name ? findManifestModules(ctx.name, manifest) : []
      const preloadLinks = renderPreloadLinks(modules, manifest)
      return preloadLinks + "<!-- preload -->" + html
    },
  }
}
