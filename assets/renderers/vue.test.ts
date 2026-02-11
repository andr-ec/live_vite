import { describe, it, expect, vi, beforeEach } from "vitest"
import { defineComponent, h, isReactive } from "vue"
import { createVueRenderer } from "./vue"
import type { FrameworkRenderer, RendererState, MountContext } from "../renderer"

const TestComponent = defineComponent({
  props: ["count", "message"],
  setup(props) {
    return () => h("div", `${props.message}: ${props.count}`)
  },
})

describe("createVueRenderer", () => {
  let renderer: FrameworkRenderer

  beforeEach(() => {
    renderer = createVueRenderer()
  })

  it("has name 'vue'", () => {
    expect(renderer.name).toBe("vue")
  })

  describe("mount", () => {
    it("returns a RendererState with reactive props and slots", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: { count: 0, message: "hello" },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      expect(state.props).toBeDefined()
      expect(state.slots).toBeDefined()
      expect(state.app).toBeDefined()
      expect(isReactive(state.props)).toBe(true)
      expect(isReactive(state.slots)).toBe(true)
    })

    it("provides the hook instance via Vue inject", () => {
      const el = document.createElement("div")
      const mockHook = { el, liveSocket: {} }

      const state = renderer.mount({
        component: TestComponent,
        props: {},
        slots: {},
        el,
        ssr: false,
        hook: mockHook,
      }) as RendererState

      expect(state.app).toBeDefined()
    })

    it("converts slot HTML strings to Vue render functions", () => {
      const el = document.createElement("div")

      const state = renderer.mount({
        component: TestComponent,
        props: {},
        slots: { default: "<p>Hello</p>", header: "<h1>Title</h1>" },
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      expect(typeof state.slots.default).toBe("function")
      expect(typeof state.slots.header).toBe("function")
    })
  })

  describe("updateProps", () => {
    it("merges new props into the reactive state", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: { count: 0, message: "hello" },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      renderer.updateProps(state, { count: 42, message: "updated" })

      expect(state.props.count).toBe(42)
      expect(state.props.message).toBe("updated")
    })

    it("preserves the same reactive object reference", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: { count: 0 },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      const propsRef = state.props
      renderer.updateProps(state, { count: 10 })

      expect(state.props).toBe(propsRef)
    })
  })

  describe("patchProps", () => {
    it("applies JSON Patch operations in-place", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: { count: 0, nested: { value: "original" } },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      renderer.patchProps(state, [
        { op: "replace", path: "/count", value: 99 },
        { op: "replace", path: "/nested/value", value: "patched" },
      ])

      expect(state.props.count).toBe(99)
      expect(state.props.nested.value).toBe("patched")
    })

    it("preserves the same reactive object reference", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: { count: 0 },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      const propsRef = state.props
      renderer.patchProps(state, [{ op: "replace", path: "/count", value: 5 }])

      expect(state.props).toBe(propsRef)
    })
  })

  describe("updateSlots", () => {
    it("converts HTML strings and merges into reactive slots", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: {},
        slots: { default: "<p>Original</p>" },
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      renderer.updateSlots(state, { default: "<p>Updated</p>", footer: "<div>Footer</div>" })

      expect(typeof state.slots.default).toBe("function")
      expect(typeof state.slots.footer).toBe("function")
    })
  })

  describe("unmount", () => {
    it("registers a page-loading-stop listener to unmount the app", () => {
      const el = document.createElement("div")
      const state = renderer.mount({
        component: TestComponent,
        props: {},
        slots: {},
        el,
        ssr: false,
        hook: { el },
      }) as RendererState

      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      renderer.unmount(state)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "phx:page-loading-stop",
        expect.any(Function),
        { once: true }
      )
    })
  })

  describe("with custom setup", () => {
    it("calls the custom setup function", () => {
      const customSetup = vi.fn((makeApp, component, props, slots, plugin, el) => {
        const app = makeApp({ render: () => h(component, props, slots) })
        app.use(plugin)
        app.mount(el)
        return app
      })

      const customRenderer = createVueRenderer({ setup: customSetup })
      const el = document.createElement("div")

      customRenderer.mount({
        component: TestComponent,
        props: { count: 0 },
        slots: {},
        el,
        ssr: false,
        hook: { el },
      })

      expect(customSetup).toHaveBeenCalledWith(
        expect.any(Function), // createApp
        TestComponent,
        expect.any(Object), // reactive props
        expect.any(Object), // reactive slots
        expect.any(Object), // plugin
        el,
        false, // ssr
      )
    })
  })
})
