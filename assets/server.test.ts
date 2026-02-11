import { describe, it, expect, vi } from "vitest"
import { getRendererRender, getMultiRendererRender } from "./server"
import type { FrameworkRenderer } from "./renderer"

function createMockRenderer(name: string, ssrHtml?: string): FrameworkRenderer {
  return {
    name,
    mount: vi.fn(),
    updateProps: vi.fn(),
    patchProps: vi.fn(),
    updateSlots: vi.fn(),
    unmount: vi.fn(),
    ...(ssrHtml !== undefined
      ? { renderToString: vi.fn().mockResolvedValue(ssrHtml) }
      : {}),
  }
}

describe("getRendererRender", () => {
  it("calls renderer.renderToString with resolved component", async () => {
    const renderer = createMockRenderer("react", "<!-- preload --><div>hello</div>")
    const component = { name: "MyComponent" }
    const resolve = vi.fn().mockResolvedValue(component)

    const render = getRendererRender(renderer, resolve)
    const html = await render("MyComponent", { count: 1 }, {})

    expect(resolve).toHaveBeenCalledWith("MyComponent")
    expect(renderer.renderToString).toHaveBeenCalledWith({
      component,
      props: { count: 1 },
      slots: {},
      name: "MyComponent",
    })
    expect(html).toBe("<!-- preload --><div>hello</div>")
  })

  it("throws if renderer does not support SSR", () => {
    const renderer = createMockRenderer("nossr")

    expect(() => getRendererRender(renderer, vi.fn())).toThrow(
      'Renderer "nossr" does not support server-side rendering'
    )
  })
})

describe("getMultiRendererRender", () => {
  it("dispatches to the correct renderer by framework name", async () => {
    const vueRenderer = createMockRenderer("vue", "<div>vue</div>")
    const reactRenderer = createMockRenderer("react", "<div>react</div>")
    const vueResolve = vi.fn().mockResolvedValue("VueComponent")
    const reactResolve = vi.fn().mockResolvedValue("ReactComponent")

    const render = getMultiRendererRender({
      vue: { renderer: vueRenderer, resolve: vueResolve },
      react: { renderer: reactRenderer, resolve: reactResolve },
    })

    const html = await render("Counter", { count: 1 }, {}, "react")

    expect(reactResolve).toHaveBeenCalledWith("Counter")
    expect(reactRenderer.renderToString).toHaveBeenCalledWith({
      component: "ReactComponent",
      props: { count: 1 },
      slots: {},
      name: "Counter",
    })
    expect(html).toBe("<div>react</div>")
    expect(vueRenderer.renderToString).not.toHaveBeenCalled()
  })

  it("falls back to single renderer when framework is omitted", async () => {
    const reactRenderer = createMockRenderer("react", "<div>only</div>")
    const resolve = vi.fn().mockResolvedValue("Component")

    const render = getMultiRendererRender({
      react: { renderer: reactRenderer, resolve },
    })

    const html = await render("App", {}, {})

    expect(resolve).toHaveBeenCalledWith("App")
    expect(html).toBe("<div>only</div>")
  })

  it("throws on unknown framework", async () => {
    const renderer = createMockRenderer("vue", "<div/>")
    const render = getMultiRendererRender({
      vue: { renderer, resolve: vi.fn() },
    })

    await expect(render("X", {}, {}, "svelte")).rejects.toThrow(
      'Unknown framework "svelte" for SSR. Registered renderers: vue'
    )
  })

  it("throws when framework is missing with multiple renderers", async () => {
    const render = getMultiRendererRender({
      vue: { renderer: createMockRenderer("vue", "<div/>"), resolve: vi.fn() },
      react: { renderer: createMockRenderer("react", "<div/>"), resolve: vi.fn() },
    })

    await expect(render("X", {}, {})).rejects.toThrow(
      "Missing framework for SSR. Registered renderers: vue, react"
    )
  })

  it("validates all renderers support SSR at creation time", () => {
    const noSsrRenderer = createMockRenderer("broken")

    expect(() =>
      getMultiRendererRender({
        broken: { renderer: noSsrRenderer, resolve: vi.fn() },
      })
    ).toThrow('Renderer "broken" does not support server-side rendering')
  })

  it("passes slots through to the renderer", async () => {
    const renderer = createMockRenderer("react", "<div/>")
    const resolve = vi.fn().mockResolvedValue("Comp")

    const render = getMultiRendererRender({
      react: { renderer, resolve },
    })

    await render("Comp", {}, { default: "<p>slot</p>" })

    expect(renderer.renderToString).toHaveBeenCalledWith(
      expect.objectContaining({
        slots: { default: "<p>slot</p>" },
      })
    )
  })
})
