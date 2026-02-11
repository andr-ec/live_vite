import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { LiveContext, useLive, useLiveEvent, useLiveNavigation, useEventReply, useLiveConnection } from "./useReact"

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

describe("useEventReply", () => {
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

  it("returns initial state with null data and not loading", () => {
    const mockHook = createMockHook()
    let result: any

    function TestComponent() {
      result = useEventReply("fetch-data")
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

    expect(result.data).toBeNull()
    expect(result.isLoading).toBe(false)
    expect(typeof result.execute).toBe("function")
    expect(typeof result.cancel).toBe("function")
  })

  it("uses defaultValue when provided", () => {
    const mockHook = createMockHook()
    let result: any

    function TestComponent() {
      result = useEventReply("fetch-data", { defaultValue: "initial" })
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

    expect(result.data).toBe("initial")
  })

  it("sets loading state and resolves with reply data", async () => {
    let pushEventCallback: any
    const mockHook = createMockHook({
      pushEvent: vi.fn((_event: string, _params: any, cb: any) => {
        pushEventCallback = cb
      }),
    })
    let result: any

    function TestComponent() {
      result = useEventReply("fetch-data")
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

    let promise: Promise<any>
    act(() => {
      promise = result.execute({ id: 1 })
    })

    expect(mockHook.pushEvent).toHaveBeenCalledWith("fetch-data", { id: 1 }, expect.any(Function))

    // Simulate server reply
    await act(async () => {
      pushEventCallback({ name: "test" })
    })

    const reply = await promise!
    expect(reply).toEqual({ name: "test" })
    expect(result.data).toEqual({ name: "test" })
    expect(result.isLoading).toBe(false)
  })

  it("cancel rejects pending promise and resets loading", async () => {
    const mockHook = createMockHook({
      pushEvent: vi.fn(),
    })
    let result: any

    function TestComponent() {
      result = useEventReply("fetch-data")
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

    let promise: Promise<any>
    act(() => {
      promise = result.execute()
    })

    act(() => {
      result.cancel()
    })

    await expect(promise!).rejects.toThrow("was cancelled")
    expect(result.isLoading).toBe(false)
  })
})

describe("useLiveConnection", () => {
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

  it("returns current connection state", () => {
    const mockHook = createMockHook({
      liveSocket: {
        socket: {
          connectionState: () => "open",
          onOpen: vi.fn(),
          onClose: vi.fn(),
          onError: vi.fn(),
          off: vi.fn(),
        },
      },
    })
    let result: any

    function TestComponent() {
      result = useLiveConnection()
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

    expect(result.connectionState).toBe("open")
    expect(result.isConnected).toBe(true)
  })

  it("updates state on socket events", () => {
    let onOpenCb: any
    let onCloseCb: any
    const mockHook = createMockHook({
      liveSocket: {
        socket: {
          connectionState: () => "open",
          onOpen: vi.fn((cb: any) => { onOpenCb = cb; return "open-ref" }),
          onClose: vi.fn((cb: any) => { onCloseCb = cb; return "close-ref" }),
          onError: vi.fn(() => "error-ref"),
          off: vi.fn(),
        },
      },
    })
    let result: any

    function TestComponent() {
      result = useLiveConnection()
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

    expect(result.isConnected).toBe(true)

    // Simulate disconnect
    act(() => {
      onCloseCb()
    })
    expect(result.connectionState).toBe("closed")
    expect(result.isConnected).toBe(false)

    // Simulate reconnect
    act(() => {
      onOpenCb()
    })
    expect(result.connectionState).toBe("open")
    expect(result.isConnected).toBe(true)
  })

  it("cleans up socket listeners on unmount", () => {
    const socket = {
      connectionState: () => "open",
      onOpen: vi.fn(() => "open-ref"),
      onClose: vi.fn(() => "close-ref"),
      onError: vi.fn(() => "error-ref"),
      off: vi.fn(),
    }
    const mockHook = createMockHook({ liveSocket: { socket } })

    function TestComponent() {
      useLiveConnection()
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

    // Unmount
    act(() => {
      root.render(createElement(LiveContext.Provider, { value: mockHook as any }, null))
    })

    expect(socket.off).toHaveBeenCalledWith(["open-ref", "close-ref", "error-ref"])
  })

  it("throws when liveSocket is not initialized", () => {
    const mockHook = createMockHook({ liveSocket: null })
    const errors: Error[] = []

    function TestComponent() {
      try {
        useLiveConnection()
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

  it("throws when socket is not available", () => {
    const mockHook = createMockHook({ liveSocket: { socket: null } })
    const errors: Error[] = []

    function TestComponent() {
      try {
        useLiveConnection()
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
    expect(errors[0].message).toContain("Socket not available")
  })
})
