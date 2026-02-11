import { describe, it, expect, vi, beforeEach } from "vitest"
import { reactive, type App } from "vue"
import { getRendererHook } from "./hooks"
import type { FrameworkRenderer, RendererState, MountContext } from "./renderer"
import type { Hook } from "./types"
import { toUtf8Base64 } from "./utils"

/**
 * Creates a mock FrameworkRenderer for testing the hook integration.
 * All methods are vi.fn() so we can assert on calls.
 */
const createMockRenderer = (): FrameworkRenderer => {
  const mockState: RendererState = {
    props: { message: "hello" },
    slots: { default: () => "slot" },
    app: { unmount: vi.fn() },
  }

  return {
    name: "mock",
    mount: vi.fn().mockResolvedValue(mockState),
    updateProps: vi.fn(),
    patchProps: vi.fn(),
    updateSlots: vi.fn(),
    unmount: vi.fn(),
  }
}

const createMockHookContext = (elementAttributes: Record<string, string> = {}) => {
  const mockElement = {
    getAttribute: vi.fn((name: string) => elementAttributes[name] || null),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  } as any

  const mockLiveSocket = {
    execJS: vi.fn(),
  }

  return {
    el: mockElement,
    liveSocket: mockLiveSocket,
    vue: undefined as any,
  } as any
}

describe("getRendererHook", () => {
  let renderer: FrameworkRenderer
  let hookContext: ReturnType<typeof createMockHookContext>
  let resolve: ReturnType<typeof vi.fn>
  let hook: Hook

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = createMockRenderer()
    resolve = vi.fn().mockResolvedValue({ template: "<div/>" })
    hook = getRendererHook(renderer, resolve)
  })

  describe("mounted lifecycle", () => {
    it("should resolve the component by name from data-name", async () => {
      hookContext = createMockHookContext({ "data-name": "Counter" })
      await hook.mounted!.call(hookContext)

      expect(resolve).toHaveBeenCalledWith("Counter")
    })

    it("should call renderer.mount with parsed props and slots", async () => {
      const props = { count: 42, label: "test" }
      const slots = { default: toUtf8Base64("<p>Hello</p>") }

      hookContext = createMockHookContext({
        "data-name": "Counter",
        "data-props": JSON.stringify(props),
        "data-slots": JSON.stringify(slots),
      })

      await hook.mounted!.call(hookContext)

      expect(renderer.mount).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining(props),
          slots: expect.objectContaining({ default: expect.any(String) }),
          el: hookContext.el,
          ssr: false,
          hook: hookContext,
        })
      )
    })

    it("should pass ssr=true when data-ssr attribute is true", async () => {
      hookContext = createMockHookContext({
        "data-name": "Counter",
        "data-ssr": "true",
      })

      await hook.mounted!.call(hookContext)

      expect(renderer.mount).toHaveBeenCalledWith(
        expect.objectContaining({ ssr: true })
      )
    })

    it("should apply initial stream diffs after mount", async () => {
      const streamDiff = [["replace", "/items", [{ id: 1, name: "test" }]]]

      hookContext = createMockHookContext({
        "data-name": "Counter",
        "data-streams-diff": JSON.stringify(streamDiff),
      })

      await hook.mounted!.call(hookContext)

      expect(renderer.patchProps).toHaveBeenCalledWith(
        expect.any(Object),
        [{ op: "replace", path: "/items", value: [{ id: 1, name: "test" }] }]
      )
    })

    it("should store renderer state on this.vue", async () => {
      hookContext = createMockHookContext({ "data-name": "Counter" })
      await hook.mounted!.call(hookContext)

      expect(hookContext.vue).toBeDefined()
      expect(hookContext.vue.props).toBeDefined()
      expect(hookContext.vue.slots).toBeDefined()
      expect(hookContext.vue.app).toBeDefined()
    })

    it("should merge handlers into props", async () => {
      const handlers = { click: '[["push", {"event": "clicked"}]]' }

      hookContext = createMockHookContext({
        "data-name": "Counter",
        "data-handlers": JSON.stringify(handlers),
      })

      await hook.mounted!.call(hookContext)

      const mountCall = (renderer.mount as any).mock.calls[0][0] as MountContext
      expect(mountCall.props).toHaveProperty("onClick")
      expect(typeof mountCall.props.onClick).toBe("function")
    })
  })

  describe("updated lifecycle", () => {
    beforeEach(async () => {
      hookContext = createMockHookContext({ "data-name": "Counter" })
      await hook.mounted!.call(hookContext)
      vi.clearAllMocks()
    })

    it("should call renderer.patchProps when diff mode is enabled", () => {
      const diff = [["replace", "/count", 10]]

      hookContext.el.getAttribute.mockImplementation((name: string) => {
        if (name === "data-use-diff") return "true"
        if (name === "data-props-diff") return JSON.stringify(diff)
        return null
      })

      hook.updated!.call(hookContext)

      expect(renderer.patchProps).toHaveBeenCalledWith(
        hookContext.vue,
        [{ op: "replace", path: "/count", value: 10 }]
      )
    })

    it("should call renderer.updateProps when diff mode is disabled", () => {
      const newProps = { count: 99, label: "updated" }

      hookContext.el.getAttribute.mockImplementation((name: string) => {
        if (name === "data-use-diff") return "false"
        if (name === "data-props") return JSON.stringify(newProps)
        return null
      })

      hook.updated!.call(hookContext)

      expect(renderer.updateProps).toHaveBeenCalledWith(
        hookContext.vue,
        expect.objectContaining(newProps)
      )
    })

    it("should always apply stream diffs", () => {
      const streamDiff = [["add", "/items/-", { id: 2 }]]

      hookContext.el.getAttribute.mockImplementation((name: string) => {
        if (name === "data-streams-diff") return JSON.stringify(streamDiff)
        return null
      })

      hook.updated!.call(hookContext)

      // patchProps should be called for stream diffs
      expect(renderer.patchProps).toHaveBeenCalledWith(
        hookContext.vue,
        [{ op: "add", path: "/items/-", value: { id: 2 } }]
      )
    })

    it("should call renderer.updateSlots with raw HTML", () => {
      const slots = { header: toUtf8Base64("<h1>Title</h1>") }

      hookContext.el.getAttribute.mockImplementation((name: string) => {
        if (name === "data-slots") return JSON.stringify(slots)
        return null
      })

      hook.updated!.call(hookContext)

      expect(renderer.updateSlots).toHaveBeenCalledWith(
        hookContext.vue,
        expect.objectContaining({ header: expect.any(String) })
      )
    })
  })

  describe("destroyed lifecycle", () => {
    it("should call renderer.unmount", async () => {
      hookContext = createMockHookContext({ "data-name": "Counter" })
      await hook.mounted!.call(hookContext)

      hook.destroyed!.call(hookContext)

      expect(renderer.unmount).toHaveBeenCalledWith(hookContext.vue)
    })
  })
})

describe("FrameworkRenderer interface contract", () => {
  it("requires name, mount, updateProps, patchProps, updateSlots, unmount", () => {
    // This is a compile-time check but we verify runtime shape too
    const renderer = createMockRenderer()

    expect(renderer.name).toBe("mock")
    expect(typeof renderer.mount).toBe("function")
    expect(typeof renderer.updateProps).toBe("function")
    expect(typeof renderer.patchProps).toBe("function")
    expect(typeof renderer.updateSlots).toBe("function")
    expect(typeof renderer.unmount).toBe("function")
  })

  it("renderToString is optional", () => {
    const renderer = createMockRenderer()
    // renderToString is not set on mock, should be undefined
    expect(renderer.renderToString).toBeUndefined()
  })
})
