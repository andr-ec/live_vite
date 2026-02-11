import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
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

// ─── useEventReply ───

export interface UseEventReplyOptions<T> {
  /** Default value to initialize data with */
  defaultValue?: T
  /** Function to transform reply data before storing it */
  updateData?: (reply: T, currentData: T | null) => T
}

export interface UseEventReplyReturn<T, P> {
  /** Data returned from the event reply */
  data: T | null
  /** Whether an event is currently executing */
  isLoading: boolean
  /** Execute the event with optional parameters */
  execute: (params?: P) => Promise<T>
  /** Cancel the current event execution */
  cancel: () => void
}

/**
 * A hook for handling LiveView events with replies.
 * Provides a reactive way to execute events and handle their responses.
 * Mirrors the Vue `useEventReply()` composable.
 *
 * @param eventName - The name of the event to send to LiveView
 * @param options - Configuration options including defaultValue and updateData function
 * @returns An object with state and control functions
 */
export function useEventReply<T = any, P extends Record<string, any> | void = Record<string, any>>(
  eventName: string,
  options?: UseEventReplyOptions<T>,
): UseEventReplyReturn<T, P> {
  const live = useLive()

  const [data, setData] = useState<T | null>(options?.defaultValue ?? null)
  const [isLoading, setIsLoading] = useState(false)

  // Mutable refs for execution token and pending reject
  const executionTokenRef = useRef(0)
  const pendingRejectRef = useRef<((reason?: any) => void) | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const execute = useCallback(
    (params?: P): Promise<T> => {
      if (isLoading) {
        return Promise.reject(new Error(`Event "${eventName}" is already executing`))
      }

      setIsLoading(true)
      const currentToken = ++executionTokenRef.current

      return new Promise<T>((resolve, reject) => {
        pendingRejectRef.current = reject

        live.pushEvent(eventName, params, (reply: T) => {
          if (currentToken === executionTokenRef.current) {
            const newData = optionsRef.current?.updateData
              ? optionsRef.current.updateData(reply, null)
              : reply
            setData(newData)
            setIsLoading(false)
            pendingRejectRef.current = null
            resolve(reply)
          }
        })
      })
    },
    [live, eventName, isLoading],
  )

  const cancel = useCallback(() => {
    if (pendingRejectRef.current) {
      pendingRejectRef.current(new Error(`Event "${eventName}" was cancelled`))
      pendingRejectRef.current = null
    }
    executionTokenRef.current++
    setIsLoading(false)
  }, [eventName])

  return { data, isLoading, execute, cancel }
}

// ─── useLiveConnection ───

export interface UseLiveConnectionReturn {
  /** Connection state: "connecting" | "open" | "closing" | "closed" */
  connectionState: string
  /** Whether the socket is currently connected */
  isConnected: boolean
}

/**
 * A hook for monitoring LiveView WebSocket connectivity status.
 * Mirrors the Vue `useLiveConnection()` composable.
 *
 * @returns An object with connection state and computed connection status
 */
export function useLiveConnection(): UseLiveConnectionReturn {
  const live = useLive()
  const liveSocket = live.liveSocket
  if (!liveSocket) throw new Error("LiveSocket not initialized")

  const socket = liveSocket.socket
  if (!socket) throw new Error("Socket not available")

  const [connectionState, setConnectionState] = useState<string>(socket.connectionState())

  useEffect(() => {
    const openRef = socket.onOpen(() => setConnectionState("open"))
    const closeRef = socket.onClose(() => setConnectionState("closed"))
    const errorRef = socket.onError(() => setConnectionState(socket.connectionState()))

    return () => {
      const refs = [openRef, closeRef, errorRef].filter((r: any) => r != null)
      if (refs.length > 0) socket.off(refs)
    }
  }, [socket])

  return {
    connectionState,
    isConnected: connectionState === "open",
  }
}
