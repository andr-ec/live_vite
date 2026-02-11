import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { LiveContext, useLive, useLiveEvent, useLiveNavigation } from "./useReact"

// Enable React act() environment for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function createMockHook(overrides: Record<string, any> = {}) {
  return {
    el: document.createElement("div"),
    liveSocket: {
      socket: { connectionState: () => "open" },
      pushHistoryPatch: vi.fn(),
      historyRedirect: vi.fn(),
    },
    pushEvent: vi.fn(() => Promise.resolve(0)),
    pushEventTo: vi.fn(() => Promise.resolve([])),
    handleEvent: vi.fn((_event: string, callback: (payload: any) => void) => ({
      event: _event,
      callback,
    })),
    removeHandleEvent: vi.fn(),
    upload: vi.fn(),
    uploadTo: vi.fn(),
    js: vi.fn(),
    ...overrides,
  }
}

describe("useLive", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    document.body.removeChild(container)
  })

  it("returns the hook from LiveContext", () => {
    const mockHook = createMockHook()
    let capturedLive: any

    function TestComponent() {
      capturedLive = useLive()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    expect(capturedLive).toBe(mockHook)
  })

  it("throws when used outside a LiveContext provider", () => {
    const errors: Error[] = []

    function TestComponent() {
      try {
        useLive()
      } catch (e) {
        errors.push(e as Error)
      }
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(createElement(TestComponent))
    })

    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain("LiveContext not provided")
  })

  it("provides access to pushEvent", () => {
    const mockHook = createMockHook()
    let capturedLive: any

    function TestComponent() {
      capturedLive = useLive()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    capturedLive.pushEvent("my-event", { data: 1 })
    expect(mockHook.pushEvent).toHaveBeenCalledWith("my-event", { data: 1 })
  })
})

describe("useLiveEvent", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    document.body.removeChild(container)
  })

  it("registers an event handler on mount", () => {
    const mockHook = createMockHook()
    const callback = vi.fn()

    function TestComponent() {
      useLiveEvent("server-event", callback)
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    expect(mockHook.handleEvent).toHaveBeenCalledWith("server-event", expect.any(Function))
  })

  it("calls the callback when the event fires", () => {
    const mockHook = createMockHook()
    const callback = vi.fn()

    function TestComponent() {
      useLiveEvent("server-event", callback)
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    // Simulate the server sending an event
    const registeredCallback = mockHook.handleEvent.mock.calls[0][1]
    registeredCallback({ value: 42 })

    expect(callback).toHaveBeenCalledWith({ value: 42 })
  })

  it("removes the event handler on unmount", () => {
    const mockHook = createMockHook()
    const callbackRef = { event: "server-event", callback: vi.fn() }
    mockHook.handleEvent.mockReturnValue(callbackRef)

    function TestComponent() {
      useLiveEvent("server-event", vi.fn())
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    // Unmount the component
    act(() => {
      root.render(createElement(LiveContext.Provider, { value: mockHook as any }, null))
    })

    expect(mockHook.removeHandleEvent).toHaveBeenCalledWith(callbackRef)
  })

  it("uses latest callback without re-subscribing", () => {
    const mockHook = createMockHook()
    const callbackRef = { event: "server-event", callback: vi.fn() }
    mockHook.handleEvent.mockReturnValue(callbackRef)

    const callback1 = vi.fn()
    const callback2 = vi.fn()

    function TestComponent({ cb }: { cb: (data: any) => void }) {
      useLiveEvent("server-event", cb)
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent, { cb: callback1 })
        )
      )
    })

    // Re-render with a different callback
    act(() => {
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent, { cb: callback2 })
        )
      )
    })

    // handleEvent should only be called once (no re-subscribe)
    expect(mockHook.handleEvent).toHaveBeenCalledTimes(1)

    // Fire the event — should use the latest callback
    const registeredCallback = mockHook.handleEvent.mock.calls[0][1]
    registeredCallback({ value: "latest" })

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledWith({ value: "latest" })
  })
})

describe("useLiveNavigation", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    document.body.removeChild(container)
  })

  it("returns patch and navigate functions", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    expect(nav).toBeDefined()
    expect(typeof nav.patch).toBe("function")
    expect(typeof nav.navigate).toBe("function")
  })

  it("patch with string href calls pushHistoryPatch", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    nav.patch("/new-path")

    expect(mockHook.liveSocket.pushHistoryPatch).toHaveBeenCalledWith(
      expect.any(Event),
      "/new-path",
      "push",
      null,
    )
  })

  it("patch with replace option uses 'replace' kind", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    nav.patch("/replaced", { replace: true })

    expect(mockHook.liveSocket.pushHistoryPatch).toHaveBeenCalledWith(
      expect.any(Event),
      "/replaced",
      "replace",
      null,
    )
  })

  it("patch with query params object builds URL from current pathname", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    nav.patch({ page: "2", sort: "name" })

    const call = mockHook.liveSocket.pushHistoryPatch.mock.calls[0]
    expect(call[1]).toContain("page=2")
    expect(call[1]).toContain("sort=name")
    expect(call[2]).toBe("push")
  })

  it("navigate calls historyRedirect", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    nav.navigate("/other-page")

    expect(mockHook.liveSocket.historyRedirect).toHaveBeenCalledWith(
      expect.any(Event),
      "/other-page",
      "push",
      null,
      null,
    )
  })

  it("navigate with replace option uses 'replace' kind", () => {
    const mockHook = createMockHook()
    let nav: any

    function TestComponent() {
      nav = useLiveNavigation()
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    nav.navigate("/replaced-page", { replace: true })

    expect(mockHook.liveSocket.historyRedirect).toHaveBeenCalledWith(
      expect.any(Event),
      "/replaced-page",
      "replace",
      null,
      null,
    )
  })

  it("throws when liveSocket is not initialized", () => {
    const mockHook = createMockHook({ liveSocket: null })
    const errors: Error[] = []

    function TestComponent() {
      try {
        useLiveNavigation()
      } catch (e) {
        errors.push(e as Error)
      }
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent)
        )
      )
    })

    expect(errors.length).toBe(1)
    expect(errors[0].message).toContain("LiveSocket not initialized")
  })
})
