import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import type { HookInterface } from "./phoenixFallbackTypes.js"

/**
 * React context for the LiveView hook instance.
 * Used by the React renderer to provide the hook to descendant components.
 */
export const LiveContext = createContext<HookInterface | null>(null)

/**
 * Returns the LiveView hook instance.
 * Can be used to access pushEvent, handleEvent, the DOM element, and liveSocket
 * from within a LiveVite React component.
 *
 * Mirrors the Vue `useLiveVite()` composable.
 */
export function useLive(): HookInterface {
  const live = useContext(LiveContext)
  if (!live) throw new Error("LiveContext not provided. Are you using this inside a LiveVite component?")
  return live
}

/**
 * Subscribes to a server-sent event and automatically cleans up on unmount.
 * Mirrors the Vue `useLiveEvent()` composable.
 *
 * @param event - The event name to listen for.
 * @param callback - The callback invoked with the event payload.
 */
export function useLiveEvent<T>(event: string, callback: (data: T) => void): void {
  const live = useLive()
  // Use a ref so the effect doesn't re-run when the callback identity changes
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const ref = live.handleEvent(event, (payload: T) => {
      callbackRef.current(payload)
    })
    return () => {
      live.removeHandleEvent(ref)
    }
  }, [live, event])
}

/**
 * Provides `patch()` and `navigate()` helpers for LiveView navigation.
 * Mirrors the Vue `useLiveNavigation()` composable.
 *
 * - `patch(href | queryParams, opts?)` – updates the current LiveView URL
 *   (equivalent to `live_patch`).
 * - `navigate(href, opts?)` – performs a full LiveView redirect
 *   (equivalent to `live_redirect`).
 *
 * @returns An object with `patch` and `navigate` functions.
 */
export function useLiveNavigation() {
  const live = useLive()
  const liveSocket = live.liveSocket
  if (!liveSocket) throw new Error("LiveSocket not initialized")

  const patch = useCallback(
    (hrefOrQueryParams: string | Record<string, string>, opts: { replace?: boolean } = {}) => {
      let href = typeof hrefOrQueryParams === "string" ? hrefOrQueryParams : window.location.pathname
      if (typeof hrefOrQueryParams === "object") {
        const queryParams = new URLSearchParams(hrefOrQueryParams)
        href = `${href}?${queryParams.toString()}`
      }
      liveSocket.pushHistoryPatch(new Event("click"), href, opts.replace ? "replace" : "push", null)
    },
    [liveSocket],
  )

  const navigate = useCallback(
    (href: string, opts: { replace?: boolean } = {}) => {
      liveSocket.historyRedirect(new Event("click"), href, opts.replace ? "replace" : "push", null, null)
    },
    [liveSocket],
  )

  return { patch, navigate }
}
