import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { LiveContext } from "./useReact"
import { useLiveUpload, type UseLiveUploadReactReturn } from "./useLiveUploadReact"
import type { UploadConfig, UploadOptions } from "./types"

// Enable React act() environment for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true

function createMockHook(overrides: Record<string, any> = {}) {
  const el = document.createElement("div")
  document.body.appendChild(el)
  return {
    el,
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

function createUploadConfig(overrides: Partial<UploadConfig> = {}): UploadConfig {
  return {
    ref: "phx-upload-ref-1",
    name: "avatar",
    accept: ".jpg,.png",
    max_entries: 1,
    auto_upload: false,
    entries: [],
    errors: [],
    ...overrides,
  }
}

const defaultOptions: UploadOptions = {
  changeEvent: "validate",
  submitEvent: "save",
}

describe("useLiveUpload (React)", () => {
  let container: HTMLDivElement
  let root: Root
  let mockHook: ReturnType<typeof createMockHook>

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    mockHook = createMockHook()
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    if (container.parentNode) {
      document.body.removeChild(container)
    }
    if (mockHook.el.parentNode) {
      document.body.removeChild(mockHook.el)
    }
  })

  // The mount helper returns an object whose `result` property is a getter
  // that always returns the latest captured hook result. Do NOT destructure
  // `result` if you need to read updated values after a rerender.
  function mountUpload(
    config: UploadConfig,
    options: UploadOptions = defaultOptions
  ): {
    readonly result: UseLiveUploadReactReturn
    rerender: (newConfig: UploadConfig) => void
  } {
    let capturedResult: UseLiveUploadReactReturn

    function TestComponent({ config: cfg }: { config: UploadConfig }) {
      capturedResult = useLiveUpload(cfg, options)
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(
          LiveContext.Provider,
          { value: mockHook as any },
          createElement(TestComponent, { config })
        )
      )
    })

    return {
      get result() {
        return capturedResult!
      },
      rerender: (newConfig: UploadConfig) => {
        act(() => {
          root.render(
            createElement(
              LiveContext.Provider,
              { value: mockHook as any },
              createElement(TestComponent, { config: newConfig })
            )
          )
        })
      },
    }
  }

  describe("initialization", () => {
    it("should create a hidden file input in the LiveView element", () => {
      mountUpload(createUploadConfig())

      const form = mockHook.el.querySelector("form")
      expect(form).not.toBeNull()
      expect(form!.style.display).toBe("none")
      expect(form!.getAttribute("phx-change")).toBe("validate")
      expect(form!.getAttribute("phx-submit")).toBe("save")

      const input = form!.querySelector("input[type='file']")
      expect(input).not.toBeNull()
      expect(input!.getAttribute("data-phx-hook")).toBe("Phoenix.LiveFileUpload")
      expect(input!.getAttribute("data-phx-update")).toBe("ignore")
      expect(input!.getAttribute("data-phx-upload-ref")).toBe("phx-upload-ref-1")
    })

    it("should set accept attribute from config", () => {
      mountUpload(createUploadConfig({ accept: ".jpg,.png,.gif" }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.accept).toBe(".jpg,.png,.gif")
    })

    it("should set multiple attribute when max_entries > 1", () => {
      mountUpload(createUploadConfig({ max_entries: 5 }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.multiple).toBe(true)
    })

    it("should not set multiple attribute when max_entries is 1", () => {
      mountUpload(createUploadConfig({ max_entries: 1 }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.multiple).toBe(false)
    })

    it("should set auto_upload attribute when enabled", () => {
      mountUpload(createUploadConfig({ auto_upload: true }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.getAttribute("data-phx-auto-upload")).toBe("true")
    })

    it("should not set auto_upload attribute when disabled", () => {
      mountUpload(createUploadConfig({ auto_upload: false }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.getAttribute("data-phx-auto-upload")).toBeNull()
    })

    it("should omit phx-change when changeEvent is not provided", () => {
      mountUpload(createUploadConfig(), { submitEvent: "save" })

      const form = mockHook.el.querySelector("form")
      expect(form!.getAttribute("phx-change")).toBeNull()
      expect(form!.getAttribute("phx-submit")).toBe("save")
    })

    it("should set input name and id from config", () => {
      mountUpload(createUploadConfig({ ref: "my-ref", name: "avatar" }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.id).toBe("my-ref")
      expect(input.name).toBe("avatar")
    })
  })

  describe("entries and derived state", () => {
    it("should return empty entries when config has no entries", () => {
      const handle = mountUpload(createUploadConfig())
      expect(handle.result.entries).toEqual([])
    })

    it("should reflect entries from the upload config", () => {
      const entries = [
        {
          ref: "0",
          client_name: "photo.jpg",
          client_size: 1024,
          client_type: "image/jpeg",
          progress: 50,
          done: false,
          valid: true,
          preflighted: true,
          errors: [],
        },
      ]

      const handle = mountUpload(createUploadConfig({ entries }))
      expect(handle.result.entries).toEqual(entries)
    })

    it("should calculate progress from entries", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 50, done: false, valid: true, preflighted: true, errors: [] },
        { ref: "1", client_name: "b.jpg", client_size: 200, client_type: "image/jpeg", progress: 100, done: true, valid: true, preflighted: true, errors: [] },
      ]

      const handle = mountUpload(createUploadConfig({ entries }))
      expect(handle.result.progress).toBe(75) // (50 + 100) / 2
    })

    it("should return 0 progress when there are no entries", () => {
      const handle = mountUpload(createUploadConfig())
      expect(handle.result.progress).toBe(0)
    })

    it("should report valid when there are no errors", () => {
      const handle = mountUpload(createUploadConfig({ errors: [] }))
      expect(handle.result.valid).toBe(true)
    })

    it("should report invalid when there are errors", () => {
      const handle = mountUpload(
        createUploadConfig({ errors: [{ ref: "0", error: "too large" }] })
      )
      expect(handle.result.valid).toBe(false)
    })

    it("should update entries when config changes", () => {
      const initialConfig = createUploadConfig()
      const handle = mountUpload(initialConfig)

      expect(handle.result.entries).toEqual([])

      const newEntries = [
        { ref: "0", client_name: "file.jpg", client_size: 512, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      handle.rerender(createUploadConfig({ entries: newEntries }))

      expect(handle.result.entries).toEqual(newEntries)
    })

    it("should update progress when entries change", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      const handle = mountUpload(createUploadConfig({ entries }))
      expect(handle.result.progress).toBe(0)

      handle.rerender(
        createUploadConfig({
          entries: [{ ...entries[0], progress: 80 }],
        })
      )
      expect(handle.result.progress).toBe(80)
    })
  })

  describe("entry ref attributes", () => {
    it("should update data-phx-active-refs when entries change", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
        { ref: "1", client_name: "b.jpg", client_size: 200, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      mountUpload(createUploadConfig({ entries }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.getAttribute("data-phx-active-refs")).toBe("0,1")
    })

    it("should update data-phx-done-refs for completed entries", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 100, done: true, valid: true, preflighted: true, errors: [] },
        { ref: "1", client_name: "b.jpg", client_size: 200, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      mountUpload(createUploadConfig({ entries }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.getAttribute("data-phx-done-refs")).toBe("0")
    })

    it("should update data-phx-preflighted-refs for preflighted entries", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 50, done: false, valid: true, preflighted: true, errors: [] },
        { ref: "1", client_name: "b.jpg", client_size: 200, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      mountUpload(createUploadConfig({ entries }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.getAttribute("data-phx-preflighted-refs")).toBe("0")
    })
  })

  describe("showFilePicker", () => {
    it("should click the hidden input element", () => {
      const handle = mountUpload(createUploadConfig())

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      const clickSpy = vi.spyOn(input, "click")

      handle.result.showFilePicker()
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe("addFiles", () => {
    it("should set files from an array of File objects and dispatch change", async () => {
      const handle = mountUpload(createUploadConfig())

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      const dispatchSpy = vi.spyOn(input, "dispatchEvent")

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" })

      // addFiles with array creates a DataTransfer internally
      // jsdom doesn't support DataTransfer, so we test the array branch directly
      // by calling the function and verifying the change event is dispatched
      handle.result.addFiles([file])

      // Change event is dispatched asynchronously
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "change", bubbles: true })
      )
    })
  })

  describe("submit", () => {
    it("should dispatch a submit event on the form", () => {
      const handle = mountUpload(createUploadConfig())

      const form = mockHook.el.querySelector("form") as HTMLFormElement
      const dispatchSpy = vi.spyOn(form, "dispatchEvent")

      handle.result.submit()

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "submit", bubbles: true })
      )
    })
  })

  describe("cancel", () => {
    it("should push cancel-upload event for a specific entry ref", () => {
      const handle = mountUpload(createUploadConfig())

      handle.result.cancel("entry-ref-0")

      expect(mockHook.pushEvent).toHaveBeenCalledWith("cancel-upload", { ref: "entry-ref-0" })
    })

    it("should push cancel-upload event for all entries when no ref is provided", () => {
      const entries = [
        { ref: "0", client_name: "a.jpg", client_size: 100, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
        { ref: "1", client_name: "b.jpg", client_size: 200, client_type: "image/jpeg", progress: 0, done: false, valid: true, preflighted: false, errors: [] },
      ]
      const handle = mountUpload(createUploadConfig({ entries }))

      handle.result.cancel()

      expect(mockHook.pushEvent).toHaveBeenCalledTimes(2)
      expect(mockHook.pushEvent).toHaveBeenCalledWith("cancel-upload", { ref: "0" })
      expect(mockHook.pushEvent).toHaveBeenCalledWith("cancel-upload", { ref: "1" })
    })
  })

  describe("clear", () => {
    it("should clear the file input value", () => {
      const handle = mountUpload(createUploadConfig())

      // Just verify clear doesn't throw and works on the input
      handle.result.clear()

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.value).toBe("")
    })
  })

  describe("cleanup", () => {
    it("should remove the form element on unmount", () => {
      mountUpload(createUploadConfig())

      expect(mockHook.el.querySelector("form")).not.toBeNull()

      act(() => {
        root.unmount()
      })

      expect(mockHook.el.querySelector("form")).toBeNull()
    })
  })

  describe("accept: false", () => {
    it("should not set accept attribute when accept is false", () => {
      mountUpload(createUploadConfig({ accept: false }))

      const input = mockHook.el.querySelector("input[type='file']") as HTMLInputElement
      expect(input.accept).toBe("")
    })
  })
})
