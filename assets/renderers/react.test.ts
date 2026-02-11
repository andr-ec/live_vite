import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, act } from "react"
import { createReactRenderer } from "./react"
import type { FrameworkRenderer, RendererState } from "../renderer"

// Enable React act() environment for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function TestComponent(props: { count?: number; message?: string }) {
  return createElement("div", null, `${props.message}: ${props.count}`)
}

describe("createReactRenderer", () => {
  let renderer: FrameworkRenderer
  let roots: RendererState[] = []

  beforeEach(() => {
    renderer = createReactRenderer()
    roots = []
  })

  afterEach(() => {
    // Unmount all roots to prevent React scheduler from running after teardown
    act(() => {
      for (const state of roots) {
        if (state.app) {
          (state.app as any).root.unmount()
          state.app = null
        }
      }
    })
  })

  function mountComponent(overrides: Partial<Parameters<typeof renderer.mount>[0]> = {}): RendererState {
    const el = overrides.el ?? document.createElement("div")
    let state: RendererState
    act(() => {
      state = renderer.mount({
        component: TestComponent,
        props: {},
        slots: {},
        el,
        ssr: false,
        hook: { el },
        ...overrides,
      }) as RendererState
    })
    roots.push(state!)
    return state!
  }

  it("has name 'react'", () => {
    expect(renderer.name).toBe("react")
  })

  describe("mount", () => {
    it("returns a RendererState with props, slots, and app", () => {
      const state = mountComponent({ props: { count: 0, message: "hello" } })

      expect(state.props).toBeDefined()
      expect(state.slots).toBeDefined()
      expect(state.app).toBeDefined()
    })

    it("stores initial props on the state", () => {
      const state = mountComponent({ props: { count: 5, message: "test" } })

      expect(state.props.count).toBe(5)
      expect(state.props.message).toBe("test")
    })

    it("converts slot HTML strings to render functions", () => {
      const state = mountComponent({
        slots: { default: "<p>Hello</p>", header: "<h1>Title</h1>" },
      })

      expect(typeof state.slots.default).toBe("function")
      expect(typeof state.slots.header).toBe("function")
    })

    it("renders content into the DOM element", () => {
      const el = document.createElement("div")
      document.body.appendChild(el)

      mountComponent({ props: { count: 42, message: "rendered" }, el })

      expect(el.textContent).toContain("rendered: 42")

      document.body.removeChild(el)
    })
  })

  describe("updateProps", () => {
    it("merges new props into the state", () => {
      const state = mountComponent({ props: { count: 0, message: "hello" } })

      act(() => {
        renderer.updateProps(state, { count: 42, message: "updated" })
      })

      expect(state.props.count).toBe(42)
      expect(state.props.message).toBe("updated")
    })

    it("preserves the same object reference", () => {
      const state = mountComponent({ props: { count: 0 } })

      const propsRef = state.props
      act(() => {
        renderer.updateProps(state, { count: 10 })
      })

      expect(state.props).toBe(propsRef)
    })
  })

  describe("patchProps", () => {
    it("applies JSON Patch operations in-place", () => {
      const state = mountComponent({ props: { count: 0, nested: { value: "original" } } })

      act(() => {
        renderer.patchProps(state, [
          { op: "replace", path: "/count", value: 99 },
          { op: "replace", path: "/nested/value", value: "patched" },
        ])
      })

      expect(state.props.count).toBe(99)
      expect(state.props.nested.value).toBe("patched")
    })

    it("creates a new object reference for React change detection", () => {
      const state = mountComponent({ props: { count: 0 } })

      const propsRef = state.props
      act(() => {
        renderer.patchProps(state, [{ op: "replace", path: "/count", value: 5 }])
      })

      // React needs new references to detect changes in hooks (useEffect, useMemo, etc.)
      expect(state.props).not.toBe(propsRef)
      expect(state.props).toStrictEqual({ count: 5 })
    })
  })

  describe("updateSlots", () => {
    it("converts HTML strings and merges into slots", () => {
      const state = mountComponent({ slots: { default: "<p>Original</p>" } })

      act(() => {
        renderer.updateSlots(state, { default: "<p>Updated</p>", footer: "<div>Footer</div>" })
      })

      expect(typeof state.slots.default).toBe("function")
      expect(typeof state.slots.footer).toBe("function")
    })
  })

  describe("unmount", () => {
    it("registers a page-loading-stop listener to unmount the root", () => {
      const state = mountComponent()

      const addEventListenerSpy = vi.spyOn(window, "addEventListener")

      renderer.unmount(state)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "phx:page-loading-stop",
        expect.any(Function),
        { once: true }
      )
    })
  })

  describe("renderToString", () => {
    it("is defined on the renderer", () => {
      expect(typeof renderer.renderToString).toBe("function")
    })

    it("renders a component to an HTML string", async () => {
      const html = await renderer.renderToString!({
        component: TestComponent,
        props: { count: 42, message: "ssr" },
        slots: {},
      })

      expect(html).toContain("ssr: 42")
    })

    it("returns HTML with preload separator", async () => {
      const html = await renderer.renderToString!({
        component: TestComponent,
        props: { count: 0, message: "test" },
        slots: {},
      })

      expect(html).toContain("<!-- preload -->")
      const [preloadLinks, content] = html.split("<!-- preload -->")
      expect(preloadLinks).toBe("")
      expect(content).toContain("test: 0")
    })

    it("renders slots as React elements with dangerouslySetInnerHTML", async () => {
      function SlotComponent(props: { header?: any }) {
        return createElement("div", null, props.header || "no slot")
      }

      const html = await renderer.renderToString!({
        component: SlotComponent,
        props: {},
        slots: { header: "<h1>Slot Content</h1>" },
      })

      expect(html).toContain("Slot Content")
    })

    it("renders with empty props and slots", async () => {
      function EmptyComponent() {
        return createElement("div", null, "empty")
      }

      const html = await renderer.renderToString!({
        component: EmptyComponent,
        props: {},
        slots: {},
      })

      expect(html).toContain("empty")
    })
  })
})
