import { createContext, useContext, useEffect, useRef } from "react"
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
