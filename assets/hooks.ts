import { migrateToLiveViteApp } from "./app.js"
import type { ComponentMap, LiveViteApp, LiveViteOptions, Hook } from "./types.js"
import { mapValues, fromUtf8Base64 } from "./utils.js"
import type { Operation } from "./jsonPatch.js"
import type { FrameworkRenderer } from "./renderer.js"
import { createVueRenderer, type VueSetupFn } from "./renderers/vue.js"

/**
 * Parses the JSON object from the element's attribute and returns them as an object.
 */
const getAttributeJson = (el: HTMLElement, attributeName: string): Record<string, any> | null => {
  const data = el.getAttribute(attributeName)
  return data ? JSON.parse(data) : null
}

/**
 * Parses raw slot data from the element's attributes.
 * Returns slot name -> decoded HTML string pairs (framework-agnostic).
 */
const getRawSlots = (el: HTMLElement): Record<string, string> => {
  const dataSlots = getAttributeJson(el, "data-slots") || {}
  return mapValues(dataSlots, base64 => fromUtf8Base64(base64))
}

const getDiff = (el: HTMLElement, attributeName: string): Operation[] => {
  const dataPropsDiff = getAttributeJson(el, attributeName) || []
  return dataPropsDiff.map(([op, path, value]: [string, string, any]) => ({
    op,
    path,
    value,
  }))
}

/**
 * Parses the event handlers from the element's attributes and returns them as a record.
 * The handlers are parsed from the "data-handlers" attribute.
 * The handlers are converted to snake case and returned as a record.
 * A special case is made for the "JS.push" event, where the event is replaced with $event.
 * @param el - The element to parse the handlers from.
 * @param liveSocket - The LiveSocket instance.
 * @returns The handlers as an object.
 */
const getHandlers = (el: HTMLElement, liveSocket: any): Record<string, (event: any) => void> => {
  const handlers = getAttributeJson(el, "data-handlers") || {}
  const result: Record<string, (event: any) => void> = {}
  for (const handlerName in handlers) {
    const ops = handlers[handlerName]
    const snakeCaseName = `on${handlerName.charAt(0).toUpperCase() + handlerName.slice(1)}`
    result[snakeCaseName] = event => {
      // a little bit of magic to replace the event with the value of the input
      const parsedOps = JSON.parse(ops)
      const replacedOps = parsedOps.map(([op, args, ...other]: [string, any, ...any[]]) => {
        if (op === "push" && !args.value) args.value = event
        return [op, args, ...other]
      })
      liveSocket.execJS(el, JSON.stringify(replacedOps))
    }
  }
  return result
}

/**
 * Parses the props from the element's attributes and returns them as an object.
 * The props are parsed from the "data-props" attribute.
 * The props are merged with the event handlers from the "data-handlers" attribute.
 * @param el - The element to parse the props from.
 * @param liveSocket - The LiveSocket instance.
 * @returns The props as an object.
 */
const getProps = (el: HTMLElement, liveSocket: any): Record<string, any> => ({
  ...(getAttributeJson(el, "data-props") || {}),
  ...getHandlers(el, liveSocket),
})

/**
 * Creates a framework-agnostic LiveView hook using the given renderer.
 *
 * This is the primary way to integrate any framework with LiveView.
 * The hook handles DOM attribute parsing, prop diffing, and stream patches,
 * while delegating all framework-specific operations to the renderer.
 */
export const getRendererHook = (
  renderer: FrameworkRenderer,
  resolve: (name: string) => Promise<unknown> | unknown,
): Hook => ({
  async mounted() {
    const componentName = this.el.getAttribute("data-name") as string
    const component = await resolve(componentName)
    const ssr = this.el.getAttribute("data-ssr") === "true"

    const props = getProps(this.el, this.liveSocket)
    const slots = getRawSlots(this.el)

    const state = await renderer.mount({
      component,
      props,
      slots,
      el: this.el,
      ssr,
      hook: this,
    })

    // apply initial stream diff after mount, since all stream changes are sent in that attribute
    renderer.patchProps(state, getDiff(this.el, "data-streams-diff"))

    this.vue = state
  },
  updated() {
    if (this.el.getAttribute("data-use-diff") === "true") {
      renderer.patchProps(this.vue, getDiff(this.el, "data-props-diff"))
    } else {
      renderer.updateProps(this.vue, getProps(this.el, this.liveSocket))
    }
    // we're always applying streams diff, since all stream changes are sent in that attribute
    renderer.patchProps(this.vue, getDiff(this.el, "data-streams-diff"))
    renderer.updateSlots(this.vue, getRawSlots(this.el))
  },
  destroyed() {
    renderer.unmount(this.vue)
  },
})

export const getVueHook = ({ resolve, setup }: LiveViteApp): Hook => {
  // Adapt the LiveViteApp setup (object arg) to the VueSetupFn (positional args)
  const vueSetup: VueSetupFn = (makeApp, component, props, slots, plugin, el, ssr) =>
    setup({ createApp: makeApp, component, props, slots, plugin, el, ssr })

  const renderer = createVueRenderer({ setup: vueSetup })
  return getRendererHook(renderer, resolve)
}

/**
 * Returns the hooks for the LiveVite app.
 * @param components - The components to use in the app.
 * @param options - The options for the LiveVite app.
 * @returns The hooks for the LiveVite app.
 */
type VueHooks = { VueHook: Hook }
type getHooksAppFn = (app: LiveViteApp) => VueHooks
type getHooksComponentsOptions = { initializeApp?: LiveViteOptions["setup"] }
type getHooksComponentsFn = (components: ComponentMap, options?: getHooksComponentsOptions) => VueHooks

export const getHooks: getHooksComponentsFn | getHooksAppFn = (
  componentsOrApp: ComponentMap | LiveViteApp,
  options?: getHooksComponentsOptions
) => {
  const app = migrateToLiveViteApp(componentsOrApp, options ?? {})
  return { VueHook: getVueHook(app) }
}
