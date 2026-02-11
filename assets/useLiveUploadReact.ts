import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLive } from "./useReact.js"
import type { UploadConfig, UploadEntry, UploadOptions } from "./types.js"

export interface UseLiveUploadReactReturn {
  /** Current entries from the upload config */
  entries: UploadEntry[]
  /** Opens the native file-picker dialog */
  showFilePicker: () => void
  /** Manually enqueue external files (e.g. drag-drop) */
  addFiles: (files: (File | Blob)[] | DataTransfer) => void
  /** Submit all currently queued files to LiveView */
  submit: () => void
  /** Cancel a single entry by ref or every entry when omitted */
  cancel: (ref?: string) => void
  /** Clear local queue and reset hidden input (post-upload cleanup) */
  clear: () => void
  /** Overall progress 0-100 derived from entries */
  progress: number
  /** The underlying hidden <input type=file> */
  inputEl: HTMLInputElement | null
  /** Whether the selected files are valid */
  valid: boolean
}

/**
 * React hook for Phoenix LiveView file uploads.
 * Provides a React-friendly API for handling file uploads with LiveView.
 * Mirrors the Vue `useLiveUpload()` composable.
 *
 * @param uploadConfig - The upload configuration from LiveView props
 * @param options - The options for the upload (changeEvent, submitEvent)
 * @returns An object with upload methods and state
 */
export function useLiveUpload(
  uploadConfig: UploadConfig,
  options: UploadOptions
): UseLiveUploadReactReturn {
  const live = useLive()
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const [, setVersion] = useState(0)
  const rerender = useCallback(() => setVersion(v => v + 1), [])

  // Keep a ref to the latest uploadConfig so the DOM update effect can read it
  const configRef = useRef(uploadConfig)
  configRef.current = uploadConfig

  // Create and manage the hidden file input element with Phoenix upload attributes
  useEffect(() => {
    const form = document.createElement("form")
    if (options.changeEvent) form.setAttribute("phx-change", options.changeEvent)
    form.setAttribute("phx-submit", options.submitEvent)
    form.style.display = "none"

    const input = document.createElement("input")
    input.type = "file"
    input.id = uploadConfig.ref
    input.name = uploadConfig.name

    // Phoenix LiveView upload attributes
    input.setAttribute("data-phx-hook", "Phoenix.LiveFileUpload")
    input.setAttribute("data-phx-update", "ignore")
    input.setAttribute("data-phx-upload-ref", uploadConfig.ref)
    form.appendChild(input)

    if (uploadConfig.accept && typeof uploadConfig.accept === "string") {
      input.accept = uploadConfig.accept
    }

    if (uploadConfig.auto_upload) {
      input.setAttribute("data-phx-auto-upload", "true")
    }

    if (uploadConfig.max_entries > 1) {
      input.multiple = true
    }

    live.el.appendChild(form)
    inputElRef.current = input
    rerender()

    return () => {
      form.remove()
      inputElRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount once

  // Update entry ref attributes when config changes
  useEffect(() => {
    const input = inputElRef.current
    if (!input) return

    const joinEntries = (entries: UploadEntry[]) => entries.map(e => e.ref).join(",")

    input.setAttribute("data-phx-active-refs", joinEntries(uploadConfig.entries))
    input.setAttribute("data-phx-done-refs", joinEntries(uploadConfig.entries.filter(e => e.done)))
    input.setAttribute("data-phx-preflighted-refs", joinEntries(uploadConfig.entries.filter(e => e.preflighted)))
  }, [uploadConfig.entries])

  // Derived state
  const entries = uploadConfig.entries || []

  const progress = useMemo(() => {
    if (entries.length === 0) return 0
    const totalProgress = entries.reduce((sum, entry) => sum + (entry.progress || 0), 0)
    return Math.round(totalProgress / entries.length)
  }, [entries])

  const valid = useMemo(() => {
    return Object.keys(uploadConfig.errors).length === 0
  }, [uploadConfig.errors])

  const showFilePicker = useCallback(() => {
    inputElRef.current?.click()
  }, [])

  const addFiles = useCallback((input: (File | Blob)[] | DataTransfer) => {
    const el = inputElRef.current
    if (!el) return

    if (typeof DataTransfer !== "undefined" && input instanceof DataTransfer) {
      el.files = input.files
    } else if (Array.isArray(input) && typeof DataTransfer !== "undefined") {
      const dataTransfer = new DataTransfer()
      input.forEach(f => dataTransfer.items.add(f as File))
      el.files = dataTransfer.files
    }

    // Dispatch change event to trigger Phoenix LiveView upload handling
    setTimeout(() => {
      if (inputElRef.current) {
        inputElRef.current.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }))
      }
    }, 0)
  }, [])

  const submit = useCallback(() => {
    inputElRef.current?.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  }, [])

  const cancel = useCallback(
    (ref?: string) => {
      if (ref) {
        live.pushEvent("cancel-upload", { ref })
      } else {
        const currentEntries = configRef.current.entries || []
        currentEntries.forEach(entry => {
          live.pushEvent("cancel-upload", { ref: entry.ref })
        })
      }
    },
    [live],
  )

  const clear = useCallback(() => {
    if (inputElRef.current) {
      inputElRef.current.value = ""
    }
  }, [])

  return {
    entries,
    showFilePicker,
    addFiles,
    submit,
    cancel,
    clear,
    progress,
    inputEl: inputElRef.current,
    valid,
  }
}
