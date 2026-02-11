import type { Operation } from "./jsonPatch.js"

/**
 * The state stored on the LiveView hook for a mounted framework component.
 * Each renderer manages its own `app` representation.
 */
export interface RendererState<TApp = unknown> {
  /** The reactive props object managed by the renderer */
  props: Record<string, any>
  /** The reactive slots object managed by the renderer */
  slots: Record<string, (...args: any[]) => any>
  /** The mounted framework application instance (opaque to the hook) */
  app: TApp | null
}

/**
 * Context passed to the renderer when mounting a component on the client.
 */
export interface MountContext {
  /** The resolved framework component */
  component: unknown
  /** Initial props parsed from the DOM */
  props: Record<string, any>
  /** Initial slots parsed from the DOM */
  slots: Record<string, string>
  /** The DOM element to mount into */
  el: Element
  /** Whether this element was server-side rendered */
  ssr: boolean
  /** The LiveView hook instance, for composables/hooks to access */
  hook: any
}

/**
 * Context passed to the renderer for server-side rendering.
 */
export interface SSRContext {
  /** The resolved framework component */
  component: unknown
  /** Props to render with */
  props: Record<string, any>
  /** Slot name -> HTML string mapping */
  slots: Record<string, string>
  /** The component name (for manifest lookups). Set by getRendererRender/getMultiRendererRender. */
  name?: string
}

/**
 * The framework renderer interface contract.
 *
 * Implement this interface to add support for a new frontend framework.
 * The renderer is responsible for:
 * - Converting raw props/slots into a reactive system the framework understands
 * - Mounting and unmounting component instances
 * - Applying incremental updates (props, slots, JSON patches) to mounted components
 * - Server-side rendering (optional)
 *
 * ## Lifecycle
 *
 * 1. `mount()` is called when the LiveView hook mounts. The renderer should:
 *    - Create reactive wrappers around props
 *    - Create slot render functions from HTML strings
 *    - Mount the framework component into the DOM element
 *    - Return a `RendererState` that the hook will store
 *
 * 2. `updateProps()` / `patchProps()` are called when the LiveView sends updates.
 *    The renderer must update the reactive props in-place to trigger re-renders.
 *
 * 3. `updateSlots()` is called when slot content changes.
 *
 * 4. `unmount()` is called when the LiveView hook is destroyed.
 *
 * ## Adding a New Framework
 *
 * ```ts
 * import type { FrameworkRenderer } from "live_vite/renderer"
 *
 * const reactRenderer: FrameworkRenderer = {
 *   name: "react",
 *   mount(ctx) { ... },
 *   updateProps(state, newProps) { ... },
 *   patchProps(state, operations) { ... },
 *   updateSlots(state, newSlots) { ... },
 *   unmount(state) { ... },
 * }
 * ```
 */
export interface FrameworkRenderer<TApp = unknown> {
  /** Human-readable name for debugging (e.g. "vue", "react", "svelte") */
  readonly name: string

  /**
   * Mount a component into the DOM.
   *
   * Called during the LiveView hook's `mounted` lifecycle.
   * The renderer should create a framework app instance, set up reactivity,
   * and mount the component into `ctx.el`.
   *
   * @returns The renderer state to be stored on the hook
   */
  mount(ctx: MountContext): Promise<RendererState<TApp>> | RendererState<TApp>

  /**
   * Replace all props with new values.
   *
   * Called when diff mode is disabled. The renderer should update the reactive
   * props object in-place (e.g. `Object.assign`) to maintain framework reactivity.
   */
  updateProps(state: RendererState<TApp>, newProps: Record<string, any>): void

  /**
   * Apply JSON Patch operations to props.
   *
   * Called when diff mode is enabled, or for stream updates.
   * The renderer should apply patches in-place on the reactive props object.
   */
  patchProps(state: RendererState<TApp>, operations: Operation[]): void

  /**
   * Update slot content.
   *
   * Called when the server sends new slot HTML. The `newSlots` map contains
   * slot name -> raw HTML string pairs. The renderer should convert these to
   * the framework's slot representation and update the reactive slots object.
   */
  updateSlots(state: RendererState<TApp>, newSlots: Record<string, string>): void

  /**
   * Unmount and clean up the component.
   *
   * Called during the LiveView hook's `destroyed` lifecycle.
   * The renderer should tear down the framework app and release resources.
   */
  unmount(state: RendererState<TApp>): void

  /**
   * Server-side render a component to an HTML string.
   *
   * Optional. If not implemented, SSR will be unavailable for this renderer.
   *
   * @returns HTML string (may include preload links separated by `<!-- preload -->`)
   */
  renderToString?(ctx: SSRContext): Promise<string>
}
