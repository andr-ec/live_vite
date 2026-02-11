import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useLive } from "./useReact.js"
import {
  parsePath,
  getValueByPath,
  setValueByPath,
  sanitizeId,
} from "./utils.js"
import type { Form, FormErrors, FormOptions, FieldOptions } from "./useLiveForm.js"

// Deep clone utility (framework-agnostic)
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj))
}

// Deep equality comparison
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== "object" || typeof b !== "object") return false

  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()

  if (keysA.length !== keysB.length) return false

  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false
    if (!deepEqual(a[keysA[i]], b[keysB[i]])) return false
  }

  return true
}

// Helper to check if any errors exist in nested error structure
function hasAnyErrors(errors: any): boolean {
  if (Array.isArray(errors)) {
    if (errors.length === 0) return false
    if (typeof errors[0] === "string") return errors.length > 0
    return errors.some((item: any) => hasAnyErrors(item))
  }
  if (typeof errors === "object" && errors !== null) {
    return Object.values(errors).some((value: any) => hasAnyErrors(value))
  }
  return false
}

// ─── React FormField interface (mirrors Vue but without Refs) ───

export interface ReactFormField<T> {
  value: T
  errors: string[]
  errorMessage: string | undefined
  isValid: boolean
  isDirty: boolean
  isTouched: boolean
  setValue: (newValue: T) => void
  blur: () => void

  inputProps: {
    value: any
    onChange: (event: any) => void
    onBlur: () => void
    name: string
    id: string
    type?: string
    checked?: boolean
    "aria-invalid": boolean
    "aria-describedby"?: string
  }

  field<K extends keyof T>(
    key: K,
    options?: FieldOptions
  ): T[K] extends readonly (infer U)[] ? ReactFormFieldArray<U> : ReactFormField<T[K]>

  fieldArray<K extends keyof T>(
    key: K
  ): T[K] extends readonly (infer U)[] ? ReactFormFieldArray<U> : never
}

export interface ReactFormFieldArray<T> extends Omit<ReactFormField<T[]>, "field" | "fieldArray"> {
  add: (item?: Partial<T>) => Promise<any>
  remove: (index: number) => Promise<any>
  move: (from: number, to: number) => Promise<any>
  fields: ReactFormField<T>[]

  field: <P extends string | number>(path: P, options?: FieldOptions) => ReactFormField<any>
  fieldArray: <P extends string | number>(path: P) => ReactFormFieldArray<any>
}

export interface UseLiveFormReactReturn<T extends object> {
  isValid: boolean
  isDirty: boolean
  isTouched: boolean
  isValidating: boolean
  submitCount: number
  initialValues: Readonly<T>

  field<P extends string>(path: P, options?: FieldOptions): ReactFormField<any>
  fieldArray<P extends string>(path: P): ReactFormFieldArray<any>

  submit: () => Promise<any>
  reset: () => void
}

// ─── React Context for form injection into children ───

export const LiveFormContext = createContext<{
  field: (path: string, options?: FieldOptions) => ReactFormField<any>
  fieldArray: (path: string) => ReactFormFieldArray<any>
} | null>(null)

// ─── Main hook ───

export function useLiveForm<T extends object>(
  form: Form<T>,
  options: FormOptions = {}
): UseLiveFormReactReturn<T> {
  const {
    changeEvent = null,
    submitEvent = "submit",
    debounceInMiliseconds = 300,
    prepareData = (data: any) => data,
  } = options

  // Get LiveView hook — may not be available (e.g. tests without LiveContext)
  let live: ReturnType<typeof useLive> | null = null
  try {
    live = useLive()
  } catch {
    // Not inside a LiveVite context — form still works for local state
  }

  // Version counter to trigger re-renders when mutable refs change
  const [, setVersion] = useState(0)
  const rerender = () => setVersion(v => v + 1)

  // ─── Mutable state stored in refs ───

  // Use a single "store" ref to hold all mutable form state.
  // This avoids stale closures and ensures field getters always
  // see the latest state without needing useCallback dependencies.
  const storeRef = useRef<{
    initialValues: T
    currentValues: T
    currentErrors: FormErrors<T>
    touchedFields: Set<string>
    submitCount: number
    debounceTimer: ReturnType<typeof setTimeout> | null
    isValidating: boolean
    fieldCache: Map<string, ReactFormField<any>[]>
    fieldArrayCache: Map<string, ReactFormFieldArray<any>>
    live: ReturnType<typeof useLive> | null
    formName: string
    changeEvent: string | null
    submitEvent: string
    debounceMs: number
    prepareData: (data: any) => any
  } | null>(null)

  // Initialize store on first render only
  if (storeRef.current === null) {
    storeRef.current = {
      initialValues: deepClone(form.values),
      currentValues: deepClone(form.values),
      currentErrors: deepClone(form.errors),
      touchedFields: new Set(),
      submitCount: 0,
      debounceTimer: null,
      isValidating: false,
      fieldCache: new Map(),
      fieldArrayCache: new Map(),
      live,
      formName: form.name,
      changeEvent,
      submitEvent,
      debounceMs: debounceInMiliseconds,
      prepareData,
    }
  }

  // Keep live reference and options up-to-date
  const store = storeRef.current
  store.live = live
  store.formName = form.name
  store.changeEvent = changeEvent
  store.submitEvent = submitEvent
  store.debounceMs = debounceInMiliseconds
  store.prepareData = prepareData

  // ─── Server update handling ───

  const prevFormRef = useRef(form)
  useEffect(() => {
    if (prevFormRef.current === form) return
    prevFormRef.current = form

    // Always update errors
    store.currentErrors = deepClone(form.errors)

    // Only update values if no validation is in progress
    if (!store.isValidating) {
      store.currentValues = deepClone(form.values)
    }

    rerender()
  })

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (store.debounceTimer !== null) {
        clearTimeout(store.debounceTimer)
      }
    }
  }, [])

  // ─── Send changes to server (debounced) ───

  function sendChanges(): Promise<any> {
    if (!store.changeEvent || !store.live) return Promise.resolve(null)

    const values = deepClone(store.currentValues)
    const data = store.prepareData(values)

    return new Promise(resolve => {
      store.live!.pushEvent(store.changeEvent!, { [store.formName]: data }, (result: any) => {
        resolve(result)
      })
    })
  }

  function debouncedSendChanges(): void {
    if (!store.changeEvent) return

    const wait = store.live && store.changeEvent ? store.debounceMs : 0
    if (wait <= 0) {
      store.isValidating = true
      sendChanges().finally(() => {
        store.isValidating = false
      })
      return
    }

    if (store.debounceTimer !== null) {
      clearTimeout(store.debounceTimer)
    }

    store.isValidating = true
    store.debounceTimer = setTimeout(() => {
      store.debounceTimer = null
      sendChanges().finally(() => {
        store.isValidating = false
      })
    }, wait)
  }

  // ─── Field creation (plain functions, close over storeRef) ───

  function createFormField<V>(path: string, options: FieldOptions = {}): ReactFormField<V> {
    if (!store.fieldCache.has(path)) {
      store.fieldCache.set(path, [])
    }
    const fieldsForPath = store.fieldCache.get(path)!
    const existing = fieldsForPath.find(f => deepEqual((f as any)._options, options))
    if (existing) return existing as ReactFormField<V>

    const keys = parsePath(path)
    const fieldId = sanitizeId(path) + (options.value !== undefined ? `_${sanitizeId(String(options.value))}` : "")

    const field: ReactFormField<V> = {
      get value(): V {
        return getValueByPath(store.currentValues, keys)
      },

      get errors(): string[] {
        const errs = getValueByPath(store.currentErrors, keys)
        return Array.isArray(errs) ? errs : []
      },

      get errorMessage(): string | undefined {
        const errs = field.errors
        return errs.length > 0 ? errs[0] : undefined
      },

      get isValid(): boolean {
        return field.errors.length === 0
      },

      get isDirty(): boolean {
        const initialVal = getValueByPath(store.initialValues, keys)
        return JSON.stringify(field.value) !== JSON.stringify(initialVal)
      },

      get isTouched(): boolean {
        return store.submitCount > 0 || store.touchedFields.has(path)
      },

      setValue(newValue: V) {
        setValueByPath(store.currentValues, keys, newValue)
        debouncedSendChanges()
        rerender()
      },

      blur() {
        store.touchedFields.add(path)
        rerender()
      },

      get inputProps() {
        const isMultiCheckbox = options.type === "checkbox" && Array.isArray(field.value)

        const baseProps = {
          name: path,
          id: fieldId,
          type: options.type,
          onBlur: () => field.blur(),
          "aria-invalid": !field.isValid as boolean,
          ...(field.errors.length > 0 ? { "aria-describedby": `${fieldId}-error` } : {}),
        }

        if (isMultiCheckbox) {
          return {
            ...baseProps,
            value: options.value,
            checked: ((field.value as any[]) || []).includes(options.value),
            onChange: (event: any) => {
              const target = event.target as HTMLInputElement
              const currentArray = [...((field.value as any[]) || [])]
              const idx = currentArray.indexOf(options.value)
              if (target.checked && idx === -1) {
                currentArray.push(options.value)
              } else if (!target.checked && idx !== -1) {
                currentArray.splice(idx, 1)
              }
              field.setValue(currentArray as any)
            },
          }
        } else if (options.type === "checkbox") {
          const optionsValue = options.value !== undefined ? options.value : true
          return {
            ...baseProps,
            value: options.value,
            checked: field.value === optionsValue,
            onChange: (event: any) => {
              const target = event.target as HTMLInputElement
              field.setValue((target.checked ? optionsValue : null) as any)
            },
          }
        } else {
          return {
            ...baseProps,
            value: field.value,
            onChange: (event: any) => {
              const target = event.target as HTMLInputElement
              field.setValue(target.value as any)
            },
          }
        }
      },

      field(key: any, opts?: FieldOptions) {
        const subPath = path ? `${path}.${String(key)}` : String(key)
        return createFormField(subPath, opts) as any
      },

      fieldArray(key: any) {
        const subPath = path ? `${path}.${String(key)}` : String(key)
        return createFormFieldArray(subPath) as any
      },
    }

    // Store options for cache comparison
    ;(field as any)._options = options
    fieldsForPath.push(field)

    return field
  }

  function createFormFieldArray<V>(path: string): ReactFormFieldArray<V> {
    if (store.fieldArrayCache.has(path)) {
      return store.fieldArrayCache.get(path) as ReactFormFieldArray<V>
    }

    const baseField = createFormField<V[]>(path)
    const keys = parsePath(path)

    const updateArray = (newArray: V[]) => {
      setValueByPath(store.currentValues, keys, newArray)
      debouncedSendChanges()
      rerender()
      return Promise.resolve()
    }

    const fieldArray: ReactFormFieldArray<V> = {
      get value() { return baseField.value },
      get errors() { return baseField.errors },
      get errorMessage() { return baseField.errorMessage },
      get isValid() { return baseField.isValid },
      get isDirty() { return baseField.isDirty },
      get isTouched() { return baseField.isTouched },
      setValue: baseField.setValue,
      blur: baseField.blur,
      get inputProps() { return baseField.inputProps },

      add(item?: Partial<V>) {
        const currentArray = baseField.value || []
        return updateArray([...currentArray, item as V])
      },

      remove(index: number) {
        const currentArray = baseField.value || []
        return updateArray(currentArray.filter((_: any, i: number) => i !== index))
      },

      move(from: number, to: number) {
        const currentArray = [...(baseField.value || [])]
        if (from >= 0 && from < currentArray.length && to >= 0 && to < currentArray.length) {
          const item = currentArray.splice(from, 1)[0]
          currentArray.splice(to, 0, item)
          return updateArray(currentArray)
        }
        return Promise.resolve()
      },

      get fields(): ReactFormField<V>[] {
        const array = baseField.value || []
        return array.map((_: any, index: number) => createFormField<V>(`${path}[${index}]`))
      },

      field(pathOrIndex: any, options?: FieldOptions) {
        if (typeof pathOrIndex === "number") {
          return createFormField(`${path}[${pathOrIndex}]`, options)
        }
        return createFormField(`${path}${pathOrIndex}`, options)
      },

      fieldArray(pathOrIndex: any) {
        if (typeof pathOrIndex === "number") {
          return createFormFieldArray(`${path}[${pathOrIndex}]`)
        }
        return createFormFieldArray(`${path}${pathOrIndex}`)
      },
    }

    store.fieldArrayCache.set(path, fieldArray)
    return fieldArray
  }

  // ─── Form actions ───

  function submit(): Promise<any> {
    store.submitCount += 1
    rerender()

    if (store.live) {
      const data = store.prepareData(deepClone(store.currentValues))

      return new Promise<any>(resolve => {
        store.live!.pushEvent(store.submitEvent, { [store.formName]: data }, (result: any) => {
          if (result && result.reset) {
            setTimeout(() => {
              Object.assign(store.initialValues, deepClone(store.currentValues))
              Object.assign(store.currentValues, deepClone(store.initialValues))
              store.touchedFields.clear()
              store.submitCount = 0
              rerender()
            }, 0)
          }
          resolve(result)
        })
      })
    } else {
      console.warn("LiveView hook not available, form submission skipped")
      return Promise.resolve(undefined)
    }
  }

  function reset(): void {
    Object.assign(store.currentValues, deepClone(store.initialValues))
    store.touchedFields.clear()
    store.submitCount = 0
    rerender()
  }

  // ─── Build return value ───

  return {
    get isValid() { return !hasAnyErrors(store.currentErrors) },
    get isDirty() { return JSON.stringify(store.currentValues) !== JSON.stringify(store.initialValues) },
    get isTouched() { return store.submitCount > 0 || store.touchedFields.size > 0 },
    get isValidating() { return store.isValidating },
    get submitCount() { return store.submitCount },
    get initialValues() { return store.initialValues as Readonly<T> },

    field(path: string, options?: FieldOptions) {
      return createFormField(path, options)
    },

    fieldArray(path: string) {
      return createFormFieldArray(path)
    },

    submit,
    reset,
  }
}

// ─── Child-component hooks ───

export function useField<T = any>(path: string, options?: FieldOptions): ReactFormField<T> {
  const form = useContext(LiveFormContext)
  if (!form) {
    throw new Error(
      "useField() can only be used inside components where a LiveFormContext.Provider is rendered. " +
        "Make sure to use useLiveForm() in a parent component and wrap children with LiveFormContext.Provider."
    )
  }
  return form.field(path, options) as ReactFormField<T>
}

export function useArrayField<T = any>(path: string): ReactFormFieldArray<T> {
  const form = useContext(LiveFormContext)
  if (!form) {
    throw new Error(
      "useArrayField() can only be used inside components where a LiveFormContext.Provider is rendered. " +
        "Make sure to use useLiveForm() in a parent component and wrap children with LiveFormContext.Provider."
    )
  }
  return form.fieldArray(path) as ReactFormFieldArray<T>
}
