import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createElement, act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { LiveContext } from "./useReact"
import {
  useLiveForm,
  useField,
  useArrayField,
  LiveFormContext,
  type ReactFormField,
  type ReactFormFieldArray,
  type UseLiveFormReactReturn,
} from "./useLiveFormReact"
import type { Form, FormErrors } from "./useLiveForm"

// Enable React act() environment for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface TestForm {
  name: string
  email: string
  age: number
  profile: {
    bio: string
    skills: string[]
  }
  items: Array<{
    name: string
    tags: string[]
  }>
  acceptTerms?: boolean
  plan?: string | boolean | null
  preferences?: string[]
}

function createMockHook(overrides: Record<string, any> = {}) {
  return {
    el: document.createElement("div"),
    liveSocket: {
      socket: { connectionState: () => "open" },
      pushHistoryPatch: vi.fn(),
      historyRedirect: vi.fn(),
    },
    pushEvent: vi.fn((_event: string, _payload: any, callback?: any) => {
      if (callback) {
        setTimeout(() => callback({ reset: true }), 0)
      }
      return Promise.resolve({ reset: true })
    }),
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

function createFormData(overrides: Partial<Form<TestForm>> = {}): Form<TestForm> {
  return {
    name: "test_form",
    values: {
      name: "John Doe",
      email: "john@example.com",
      age: 30,
      profile: {
        bio: "Software developer",
        skills: ["JavaScript", "TypeScript"],
      },
      items: [
        { name: "Item 1", tags: ["tag1", "tag2"] },
        { name: "Item 2", tags: ["tag3"] },
      ],
    },
    errors: {} as FormErrors<TestForm>,
    valid: true,
    ...overrides,
  }
}

function createFormWithErrors(): Form<TestForm> {
  return createFormData({
    errors: {
      name: ["Name is required"],
      email: ["Invalid email format"],
      age: [],
      profile: {
        bio: ["Bio is too short"],
        skills: [],
      },
      items: [
        { name: ["Item name required"], tags: [] },
        { name: [], tags: [] },
      ],
    },
  })
}

// Helper to render a React component that uses useLiveForm and capture the result
function renderWithForm<T extends object>(
  mockHook: any,
  formData: Form<T>,
  options: any = {},
  captureCallback: (result: UseLiveFormReactReturn<T>) => void
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div")
  document.body.appendChild(container)

  function TestComponent() {
    const form = useLiveForm(formData, options)
    captureCallback(form)
    return createElement("div", null, "test")
  }

  let root: Root
  act(() => {
    root = createRoot(container)
    root.render(
      createElement(LiveContext.Provider, { value: mockHook as any },
        createElement(TestComponent)
      )
    )
  })

  return { container, root: root! }
}

describe("useLiveForm (React)", () => {
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
  })

  // Helper to mount a component with useLiveForm
  function mountForm(
    formData: Form<TestForm>,
    options: any = {}
  ): { form: UseLiveFormReactReturn<TestForm>; rerender: (newForm: Form<TestForm>) => void } {
    let capturedForm: UseLiveFormReactReturn<TestForm>
    let setFormData: (f: Form<TestForm>) => void

    function TestComponent({ formProp }: { formProp: Form<TestForm> }) {
      const [form, setForm] = (globalThis as any).React
        ? (globalThis as any).React.useState(formProp)
        : (() => {
            // inline useState equivalent for test
            const ref = { current: formProp }
            return [ref.current, (v: Form<TestForm>) => { ref.current = v }]
          })()
      capturedForm = useLiveForm(formProp, options)
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveContext.Provider, { value: mockHook as any },
          createElement(TestComponent, { formProp: formData })
        )
      )
    })

    return {
      get form() { return capturedForm! },
      rerender: (newForm: Form<TestForm>) => {
        act(() => {
          root.render(
            createElement(LiveContext.Provider, { value: mockHook as any },
              createElement(TestComponent, { formProp: newForm })
            )
          )
        })
      },
    }
  }

  describe("basic form initialization", () => {
    it("should initialize form with proper state", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.initialValues).toEqual(formData.values)
      expect(form.isValid).toBe(true)
      expect(form.isDirty).toBe(false)
      expect(form.isTouched).toBe(false)
    })

    it("should create deep copy of initial values", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      // Modify the original
      formData.values.name = "Modified"

      // Form should still have original value
      expect(form.initialValues.name).toBe("John Doe")
    })
  })

  describe("field creation and path resolution", () => {
    it("should create field for simple property", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const nameField = form.field("name")

      expect(nameField.value).toBe("John Doe")
      expect(nameField.errors).toEqual([])
      expect(nameField.errorMessage).toBeUndefined()
      expect(nameField.isValid).toBe(true)
      expect(nameField.isDirty).toBe(false)
      expect(nameField.isTouched).toBe(false)
    })

    it("should create field for nested property", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const bioField = form.field("profile.bio")

      expect(bioField.value).toBe("Software developer")
      expect(bioField.isValid).toBe(true)
    })

    it("should create field for array element", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const itemNameField = form.field("items[0].name")

      expect(itemNameField.value).toBe("Item 1")
      expect(itemNameField.isValid).toBe(true)
    })

    it("should create field for nested array element", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const tagField = form.field("items[0].tags[0]")

      expect(tagField.value).toBe("tag1")
    })
  })

  describe("field value updates", () => {
    it("should update field value via setValue", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const nameField = form.field("name")

      act(() => {
        nameField.setValue("Jane Doe")
      })

      expect(form.field("name").value).toBe("Jane Doe")
    })

    it("should update nested field value", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const bioField = form.field("profile.bio")

      act(() => {
        bioField.setValue("Updated bio")
      })

      expect(form.field("profile.bio").value).toBe("Updated bio")
    })

    it("should update array element", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const itemNameField = form.field("items[0].name")

      act(() => {
        itemNameField.setValue("Updated Item")
      })

      expect(form.field("items[0].name").value).toBe("Updated Item")
    })
  })

  describe("sub-field creation (fluent interface)", () => {
    it("should create sub-field from object field", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const profileField = form.field("profile")
      const bioField = profileField.field("bio")

      expect(bioField.value).toBe("Software developer")
    })

    it("should create sub-field from array field", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const itemsArray = form.fieldArray("items")
      const firstItemField = itemsArray.field(0)
      const nameField = firstItemField.field("name")

      expect(nameField.value).toBe("Item 1")
    })
  })

  describe("field state tracking", () => {
    it("should track touched state when blur is called", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const nameField = form.field("name")

      expect(nameField.isTouched).toBe(false)
      expect(form.isTouched).toBe(false)

      act(() => {
        nameField.blur()
      })

      expect(form.field("name").isTouched).toBe(true)
      expect(form.isTouched).toBe(true)
    })

    it("should track dirty state when value changes", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.field("name").isDirty).toBe(false)

      act(() => {
        form.field("name").setValue("Jane Doe")
      })

      expect(form.field("name").isDirty).toBe(true)
    })

    it("should not be dirty when value is same as initial", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.field("name").setValue("Jane Doe")
      })
      expect(form.field("name").isDirty).toBe(true)

      act(() => {
        form.field("name").setValue("John Doe") // Back to original
      })
      expect(form.field("name").isDirty).toBe(false)
    })
  })

  describe("form reset", () => {
    it("should reset all values to initial state", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.field("name").setValue("Jane Doe")
        form.field("profile.bio").setValue("Updated bio")
        form.field("name").blur()
      })

      expect(form.field("name").value).toBe("Jane Doe")
      expect(form.field("profile.bio").value).toBe("Updated bio")
      expect(form.field("name").isTouched).toBe(true)

      act(() => {
        form.reset()
      })

      expect(form.field("name").value).toBe("John Doe")
      expect(form.field("profile.bio").value).toBe("Software developer")
      expect(form.field("name").isTouched).toBe(false)
      expect(form.isTouched).toBe(false)
    })
  })

  describe("validation and error handling", () => {
    it("should reflect validation errors from server", () => {
      const formData = createFormWithErrors()
      const { form } = mountForm(formData)

      expect(form.isValid).toBe(false)

      const nameField = form.field("name")
      expect(nameField.errors).toEqual(["Name is required"])
      expect(nameField.errorMessage).toBe("Name is required")
      expect(nameField.isValid).toBe(false)

      const emailField = form.field("email")
      expect(emailField.errors).toEqual(["Invalid email format"])
      expect(emailField.isValid).toBe(false)

      const ageField = form.field("age")
      expect(ageField.errors).toEqual([])
      expect(ageField.isValid).toBe(true)

      const bioField = form.field("profile.bio")
      expect(bioField.errors).toEqual(["Bio is too short"])
      expect(bioField.isValid).toBe(false)

      const itemNameField = form.field("items[0].name")
      expect(itemNameField.errors).toEqual(["Item name required"])
      expect(itemNameField.isValid).toBe(false)
    })

    it("should handle multiple errors on single field", () => {
      const formData = createFormData({
        errors: {
          name: ["Name is required", "Name must be at least 2 characters"],
        },
      })

      const { form } = mountForm(formData)
      const nameField = form.field("name")

      expect(nameField.errors).toEqual(["Name is required", "Name must be at least 2 characters"])
      expect(nameField.errorMessage).toBe("Name is required")
      expect(nameField.isValid).toBe(false)
    })
  })

  describe("inputProps helper", () => {
    it("should provide basic input properties", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const nameField = form.field("name")

      const props = nameField.inputProps

      expect(props.value).toBe("John Doe")
      expect(props.name).toBe("name")
      expect(props.id).toBe("name")
      expect(props["aria-invalid"]).toBe(false)
      expect(props["aria-describedby"]).toBeUndefined()
      expect(typeof props.onBlur).toBe("function")
      expect(typeof props.onChange).toBe("function")
    })

    it("should sanitize path for ID attribute", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const bioField = form.field("profile.bio")
      expect(bioField.inputProps.id).toBe("profile_bio")
      expect(bioField.inputProps.name).toBe("profile.bio")

      const itemNameField = form.field("items[0].name")
      expect(itemNameField.inputProps.id).toBe("items_0_name")
      expect(itemNameField.inputProps.name).toBe("items[0].name")

      const tagField = form.field("items[1].tags[0]")
      expect(tagField.inputProps.id).toBe("items_1_tags_0")
      expect(tagField.inputProps.name).toBe("items[1].tags[0]")
    })

    it("should handle onChange updates", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const nameField = form.field("name")

      const mockEvent = { target: { value: "New Name" } }
      act(() => {
        nameField.inputProps.onChange(mockEvent)
      })

      expect(form.field("name").value).toBe("New Name")
      expect(form.field("name").inputProps.value).toBe("New Name")
    })

    it("should handle blur event", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.field("name").isTouched).toBe(false)

      act(() => {
        form.field("name").inputProps.onBlur()
      })

      expect(form.field("name").isTouched).toBe(true)
    })

    it("should set aria-invalid when field has errors", () => {
      const formData = createFormWithErrors()
      const { form } = mountForm(formData)

      expect(form.field("name").inputProps["aria-invalid"]).toBe(true)
      expect(form.field("email").inputProps["aria-invalid"]).toBe(true)
      expect(form.field("age").inputProps["aria-invalid"]).toBe(false)
    })

    it("should set aria-describedby when field has errors", () => {
      const formData = createFormWithErrors()
      const { form } = mountForm(formData)

      expect(form.field("name").inputProps["aria-describedby"]).toBe("name-error")
      expect(form.field("age").inputProps["aria-describedby"]).toBeUndefined()

      const bioField = form.field("profile.bio")
      expect(bioField.inputProps["aria-describedby"]).toBe("profile_bio-error")
    })

    it("should work with array fields", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const skillsArray = form.fieldArray("profile.skills")
      const firstSkillField = skillsArray.field(0)

      const props = firstSkillField.inputProps

      expect(props.value).toBe("JavaScript")
      expect(props.name).toBe("profile.skills[0]")
      expect(props.id).toBe("profile_skills_0")
      expect(props["aria-invalid"]).toBe(false)
    })

    it("should allow chaining with sub-fields", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const profileField = form.field("profile")
      const bioField = profileField.field("bio")

      const props = bioField.inputProps

      expect(props.value).toBe("Software developer")
      expect(props.name).toBe("profile.bio")
      expect(props.id).toBe("profile_bio")
    })
  })

  describe("form-level dirty tracking", () => {
    it("should track form as dirty when any field changes", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.isDirty).toBe(false)

      act(() => {
        form.field("name").setValue("Jane Doe")
      })

      expect(form.isDirty).toBe(true)
    })

    it("should track form as dirty when nested field changes", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.isDirty).toBe(false)

      act(() => {
        form.field("profile.bio").setValue("Updated bio")
      })

      expect(form.isDirty).toBe(true)
    })

    it("should track form as dirty when array field changes", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.isDirty).toBe(false)

      act(() => {
        form.fieldArray("profile.skills").add("Vue.js")
      })

      expect(form.isDirty).toBe(true)
    })

    it("should not be dirty when reset to initial values", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.field("name").setValue("Jane Doe")
      })
      expect(form.isDirty).toBe(true)

      act(() => {
        form.reset()
      })
      expect(form.isDirty).toBe(false)
    })
  })

  describe("array field creation", () => {
    it("should create array field with proper methods", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const skillsArray = form.fieldArray("profile.skills")

      expect(skillsArray.value).toEqual(["JavaScript", "TypeScript"])
      expect(skillsArray.fields).toHaveLength(2)
      expect(skillsArray.fields[0].value).toBe("JavaScript")
      expect(skillsArray.fields[1].value).toBe("TypeScript")
    })

    it("should add items to array", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.fieldArray("profile.skills").add("Vue.js")
      })

      const skillsArray = form.fieldArray("profile.skills")
      expect(skillsArray.value).toEqual(["JavaScript", "TypeScript", "Vue.js"])
      expect(skillsArray.fields).toHaveLength(3)
    })

    it("should remove items from array", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.fieldArray("profile.skills").remove(0)
      })

      const skillsArray = form.fieldArray("profile.skills")
      expect(skillsArray.value).toEqual(["TypeScript"])
      expect(skillsArray.fields).toHaveLength(1)
    })

    it("should move items in array", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.fieldArray("profile.skills").move(0, 1)
      })

      const skillsArray = form.fieldArray("profile.skills")
      expect(skillsArray.value).toEqual(["TypeScript", "JavaScript"])
    })

    it("should handle complex nested array operations", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const itemsArray = form.fieldArray("items")

      expect(itemsArray.fields).toHaveLength(2)
      expect(itemsArray.fields[0].field("name").value).toBe("Item 1")
      expect(itemsArray.fields[1].field("name").value).toBe("Item 2")

      act(() => {
        itemsArray.add({ name: "Item 3", tags: ["tag4"] })
      })

      const updated = form.fieldArray("items")
      expect(updated.fields).toHaveLength(3)
      expect(updated.fields[2].field("name").value).toBe("Item 3")

      const secondItem = updated.field("[1].name")
      expect(secondItem.value).toBe("Item 2")

      const firstItemTags = updated.fieldArray("[0].tags")
      expect(firstItemTags.value).toEqual(["tag1", "tag2"])
    })

    it("should maintain consistency when array items are modified", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.fieldArray("items").fields[0].field("name").setValue("Modified Item 1")
      })

      expect(form.fieldArray("items").field("[0].name").value).toBe("Modified Item 1")
      expect(form.fieldArray("items").field(0).field("name").value).toBe("Modified Item 1")
      expect(form.field("items[0].name").value).toBe("Modified Item 1")
    })

    it("should handle array move operations correctly", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.fieldArray("profile.skills").move(0, 1)
      })

      const skillsArray = form.fieldArray("profile.skills")
      expect(skillsArray.value).toEqual(["TypeScript", "JavaScript"])
      expect(skillsArray.fields[0].value).toBe("TypeScript")
      expect(skillsArray.fields[1].value).toBe("JavaScript")
    })

    it("should track dirty state for array operations", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.fieldArray("profile.skills").isDirty).toBe(false)
      expect(form.isDirty).toBe(false)

      act(() => {
        form.fieldArray("profile.skills").add("Vue.js")
      })

      expect(form.fieldArray("profile.skills").isDirty).toBe(true)
      expect(form.isDirty).toBe(true)

      act(() => {
        form.fieldArray("profile.skills").remove(2)
      })

      expect(form.fieldArray("profile.skills").isDirty).toBe(false)
      expect(form.isDirty).toBe(false)
    })

    it("should handle array validation errors", () => {
      const formData = createFormData({
        errors: {
          items: [
            { name: ["First item name is required"], tags: [] },
            { name: [], tags: [["Invalid tag format"]] },
          ],
        },
      })

      const { form } = mountForm(formData)
      const itemsArray = form.fieldArray("items")

      expect(form.isValid).toBe(false)
      expect(itemsArray.isValid).toBe(false)

      const firstItemName = itemsArray.field("[0].name")
      expect(firstItemName.errors).toEqual(["First item name is required"])
      expect(firstItemName.isValid).toBe(false)

      const secondItemTags = itemsArray.fieldArray("[1].tags")
      expect(secondItemTags.errors).toEqual([["Invalid tag format"]])
      expect(secondItemTags.isValid).toBe(false)

      const secondItemTagsFirstTag = secondItemTags.field(0)
      expect(secondItemTagsFirstTag.errors).toEqual(["Invalid tag format"])
      expect(secondItemTagsFirstTag.isValid).toBe(false)
    })

    it("should support both string paths and number shortcuts in array field API", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const itemsArray = form.fieldArray("items")

      const firstItemNameByStringPath = itemsArray.field("[0].name")
      expect(firstItemNameByStringPath.value).toBe("Item 1")

      const firstItemTagsByStringPath = itemsArray.fieldArray("[0].tags")
      expect(firstItemTagsByStringPath.value).toEqual(["tag1", "tag2"])

      const firstItemByNumber = itemsArray.field(0)
      expect(firstItemByNumber.field("name").value).toBe("Item 1")

      const firstItemTagsArrayByNumber = itemsArray.field(0).fieldArray("tags")
      expect(firstItemTagsArrayByNumber.value).toEqual(["tag1", "tag2"])

      expect(firstItemNameByStringPath.value).toBe(firstItemByNumber.field("name").value)
    })
  })

  describe("integration tests - LiveView form lifecycle", () => {
    it("should handle form submission", async () => {
      const formData = createFormData()
      const { form } = mountForm(formData, { submitEvent: "submit_form" })

      await act(async () => {
        await form.submit()
      })

      expect(mockHook.pushEvent).toHaveBeenCalledWith(
        "submit_form",
        {
          test_form: expect.objectContaining({
            name: "John Doe",
            email: "john@example.com",
          }),
        },
        expect.any(Function)
      )
    })

    it("should use prepareData function before sending to server", async () => {
      const formData = createFormData()
      const prepareData = vi.fn((data: any) => ({ transformed: data }))
      const { form } = mountForm(formData, { prepareData })

      act(() => {
        form.field("name").setValue("Modified Name")
      })

      await act(async () => {
        await form.submit()
      })

      expect(prepareData).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Modified Name" })
      )
      expect(mockHook.pushEvent).toHaveBeenCalledWith(
        "submit",
        {
          test_form: { transformed: expect.objectContaining({ name: "Modified Name" }) },
        },
        expect.any(Function)
      )
    })

    it("should handle cases when LiveView is not available", async () => {
      // Mount without LiveContext provider — pass stable form reference as prop
      let capturedForm: UseLiveFormReactReturn<TestForm>
      const formData = createFormData()

      function TestComponent({ formProp }: { formProp: Form<TestForm> }) {
        capturedForm = useLiveForm(formProp)
        return createElement("div", null, "test")
      }

      act(() => {
        root = createRoot(container)
        root.render(createElement(TestComponent, { formProp: formData }))
      })

      // Should not throw and should resolve
      await act(async () => {
        await expect(capturedForm!.submit()).resolves.toBeUndefined()
      })
    })

    it("should update fields when server form data changes via re-render", () => {
      const formData = createFormData()
      const { form, rerender } = mountForm(formData)

      expect(form.field("name").value).toBe("John Doe")
      expect(form.field("name").errors).toEqual([])

      // Simulate server update
      rerender({
        name: "test_form",
        values: {
          ...formData.values,
          name: "Jane Smith",
          email: "jane@example.com",
        },
        errors: {
          name: ["Name already taken"],
        } as unknown as FormErrors<TestForm>,
        valid: false,
      })

      expect(form.field("name").value).toBe("Jane Smith")
      expect(form.field("email").value).toBe("jane@example.com")
      expect(form.field("name").errors).toEqual(["Name already taken"])
    })

    it("should send debounced change events when changeEvent is configured", async () => {
      const formData = createFormData()
      const { form } = mountForm(formData, {
        changeEvent: "validate",
        debounceInMiliseconds: 10,
      })

      act(() => {
        form.field("name").setValue("J")
      })
      act(() => {
        form.field("name").setValue("Ja")
      })
      act(() => {
        form.field("name").setValue("Jan")
      })
      act(() => {
        form.field("name").setValue("Jane")
      })

      // Should not have sent any events yet
      expect(mockHook.pushEvent).not.toHaveBeenCalled()

      // Wait for debounce delay
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      // Should have sent only one validation event with final value
      expect(mockHook.pushEvent).toHaveBeenCalledTimes(1)
      expect(mockHook.pushEvent).toHaveBeenCalledWith(
        "validate",
        {
          test_form: expect.objectContaining({ name: "Jane" }),
        },
        expect.any(Function)
      )
    })

    it("should not send validation events when changeEvent is null", async () => {
      const formData = createFormData()
      const { form } = mountForm(formData, {
        changeEvent: null,
        debounceInMiliseconds: 10,
      })

      act(() => {
        form.field("name").setValue("Modified Name")
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      expect(mockHook.pushEvent).not.toHaveBeenCalled()
    })

    it("should use form name as key in event payload", async () => {
      const formData = createFormData({ name: "user_form" })
      const { form } = mountForm(formData, {
        changeEvent: "validate",
        submitEvent: "save",
        debounceInMiliseconds: 10,
      })

      act(() => {
        form.field("name").setValue("New Name")
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      })

      expect(mockHook.pushEvent).toHaveBeenCalledWith(
        "validate",
        {
          user_form: expect.objectContaining({ name: "New Name" }),
        },
        expect.any(Function)
      )

      await act(async () => {
        await form.submit()
      })

      expect(mockHook.pushEvent).toHaveBeenCalledWith(
        "save",
        {
          user_form: expect.objectContaining({ name: "New Name" }),
        },
        expect.any(Function)
      )
    })

    it("should clear field errors when server removes them", () => {
      const formData = createFormWithErrors()
      const { form, rerender } = mountForm(formData)

      expect(form.field("name").errors).toEqual(["Name is required"])
      expect(form.field("email").errors).toEqual(["Invalid email format"])
      expect(form.field("profile.bio").errors).toEqual(["Bio is too short"])
      expect(form.isValid).toBe(false)

      // Server clears some errors
      rerender({
        ...formData,
        errors: {
          email: ["Invalid email format"],
        } as unknown as FormErrors<TestForm>,
      })

      expect(form.field("name").errors).toEqual([])
      expect(form.field("profile.bio").errors).toEqual([])
      expect(form.field("name").isValid).toBe(true)
      expect(form.field("profile.bio").isValid).toBe(true)

      expect(form.field("email").errors).toEqual(["Invalid email format"])
      expect(form.field("email").isValid).toBe(false)
      expect(form.isValid).toBe(false)

      // Clear all errors
      rerender({
        ...formData,
        errors: {} as FormErrors<TestForm>,
      })

      expect(form.field("name").errors).toEqual([])
      expect(form.field("email").errors).toEqual([])
      expect(form.field("profile.bio").errors).toEqual([])
      expect(form.isValid).toBe(true)
    })

    it("should mark all fields as touched when submit is called, then reset on success", async () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.field("name").isTouched).toBe(false)
      expect(form.field("email").isTouched).toBe(false)
      expect(form.isTouched).toBe(false)

      await act(async () => {
        await form.submit()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // After successful submit with reset, touched state should be cleared
      expect(form.field("name").isTouched).toBe(false)
      expect(form.field("email").isTouched).toBe(false)
      expect(form.isTouched).toBe(false)
    })

    it("should track submit count", async () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      expect(form.submitCount).toBe(0)

      await act(async () => {
        await form.submit()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      // Should be reset to 0 after successful submit
      expect(form.submitCount).toBe(0)

      act(() => {
        form.reset()
      })
      expect(form.submitCount).toBe(0)
    })

    it("should not reset on failed submission", async () => {
      mockHook.pushEvent.mockImplementation((_event: string, _payload: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback({ error: "Submission failed" }), 0)
        }
        return Promise.resolve({ error: "Submission failed" })
      })

      const formData = createFormData()
      const { form } = mountForm(formData, { submitEvent: "submit_form" })

      act(() => {
        form.field("name").setValue("Jane Smith")
        form.field("name").blur()
      })

      expect(form.isDirty).toBe(true)
      expect(form.isTouched).toBe(true)
      expect(form.submitCount).toBe(0)

      let result: any
      await act(async () => {
        result = await form.submit()
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      expect(result.error).toBe("Submission failed")

      // State should remain unchanged after failed submit
      expect(form.isDirty).toBe(true)
      expect(form.isTouched).toBe(true)
      expect(form.field("name").isTouched).toBe(true)
      expect(form.submitCount).toBe(1)
      expect(form.initialValues.name).toBe("John Doe")
      expect(form.field("name").value).toBe("Jane Smith")
    })
  })

  describe("checkbox functionality", () => {
    it("should create boolean checkbox field with correct inputProps", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)
      const checkboxField = form.field("acceptTerms", { type: "checkbox" })

      expect(checkboxField.inputProps.type).toBe("checkbox")
      expect(checkboxField.inputProps.checked).toBe(false)
      expect(checkboxField.inputProps.value).toBe(undefined)
    })

    it("should create single checkbox with custom value", () => {
      const formData = createFormData({ values: { ...createFormData().values, plan: null } })
      const { form } = mountForm(formData)
      const checkboxField = form.field("plan", { type: "checkbox", value: "premium" })

      expect(checkboxField.inputProps.type).toBe("checkbox")
      expect(checkboxField.inputProps.checked).toBe(false)
      expect(checkboxField.inputProps.value).toBe("premium")
    })

    it("should auto-detect multi-checkbox when field value is an array", () => {
      const formData = createFormData({ values: { ...createFormData().values, preferences: [] } })
      const { form } = mountForm(formData)

      const emailField = form.field("preferences", { type: "checkbox", value: "email" })
      expect(emailField.inputProps.checked).toBe(false)

      const smsField = form.field("preferences", { type: "checkbox", value: "sms" })
      expect(smsField.inputProps.checked).toBe(false)

      expect(emailField.inputProps.value).toBe("email")
      expect(smsField.inputProps.value).toBe("sms")

      // Test checking email checkbox
      act(() => {
        emailField.inputProps.onChange({ target: { checked: true } })
      })

      expect(form.field("preferences", { type: "checkbox", value: "email" }).inputProps.checked).toBe(true)
      expect(form.field("preferences", { type: "checkbox", value: "sms" }).inputProps.checked).toBe(false)
    })

    it("should handle boolean checkbox input events", () => {
      const formData = createFormData({ values: { ...createFormData().values, acceptTerms: false } })
      const { form } = mountForm(formData)
      const checkboxField = form.field("acceptTerms", { type: "checkbox" })

      expect(checkboxField.value).toBe(false)

      act(() => {
        checkboxField.inputProps.onChange({ target: { checked: true } })
      })

      expect(form.field("acceptTerms", { type: "checkbox" }).value).toBe(true)
    })

    it("should handle checkbox with custom value input events", () => {
      const formData = createFormData({ values: { ...createFormData().values, plan: false } })
      const { form } = mountForm(formData)
      const checkboxField = form.field("plan", { type: "checkbox", value: "premium" })

      expect(checkboxField.value).toBe(false)

      act(() => {
        checkboxField.inputProps.onChange({ target: { checked: true } })
      })

      expect(form.field("plan", { type: "checkbox", value: "premium" }).value).toBe("premium")
    })

    it("should memoize checkbox fields with same options", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const field1 = form.field("preferences", { type: "checkbox", value: "email" })
      const field2 = form.field("preferences", { type: "checkbox", value: "email" })

      expect(field1).toBe(field2)
    })

    it("should create separate instances for different checkbox values", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const emailField = form.field("preferences", { type: "checkbox", value: "email" })
      const smsField = form.field("preferences", { type: "checkbox", value: "sms" })

      expect(emailField).not.toBe(smsField)
    })
  })

  describe("performance optimizations", () => {
    it("should memoize field instances", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const nameField1 = form.field("name")
      const nameField2 = form.field("name")

      expect(nameField1).toBe(nameField2)
    })

    it("should memoize nested field instances", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const bioField1 = form.field("profile.bio")
      const bioField2 = form.field("profile.bio")

      expect(bioField1).toBe(bioField2)
    })

    it("should memoize array field instances", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const skillsArray1 = form.fieldArray("profile.skills")
      const skillsArray2 = form.fieldArray("profile.skills")

      expect(skillsArray1).toBe(skillsArray2)
    })

    it("should memoize sub-field instances created via fluent interface", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const profileField = form.field("profile")
      const bioField1 = profileField.field("bio")
      const bioField2 = profileField.field("bio")

      expect(bioField1).toBe(bioField2)

      // Should also be the same as direct path access
      const bioField3 = form.field("profile.bio")
      expect(bioField1).toBe(bioField3)
    })

    it("should clear field values on reset", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      act(() => {
        form.field("name").setValue("Modified Name")
      })

      act(() => {
        form.reset()
      })

      expect(form.field("name").value).toBe("John Doe")
    })

    it("should handle concurrent field creation efficiently", () => {
      const formData = createFormData()
      const { form } = mountForm(formData)

      const fields = Array.from({ length: 100 }, () => form.field("name"))

      expect(fields.every(field => field === fields[0])).toBe(true)
    })
  })
})

describe("useField (React)", () => {
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
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })

  it("throws when used outside LiveFormContext", () => {
    const errors: Error[] = []

    function TestComponent() {
      try {
        useField("name")
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
    expect(errors[0].message).toContain("useField()")
    expect(errors[0].message).toContain("LiveFormContext")
  })

  it("returns a field from the provided form context", () => {
    let capturedField: ReactFormField<any>
    const mockFormContext = {
      field: vi.fn((path: string) => ({
        value: "test-value",
        errors: [],
        errorMessage: undefined,
        isValid: true,
        isDirty: false,
        isTouched: false,
        setValue: vi.fn(),
        blur: vi.fn(),
        inputProps: {} as any,
        field: vi.fn(),
        fieldArray: vi.fn(),
      })),
      fieldArray: vi.fn(),
    }

    function TestComponent() {
      capturedField = useField("name")
      return createElement("div", null, "test")
    }

    act(() => {
      root = createRoot(container)
      root.render(
        createElement(LiveFormContext.Provider, { value: mockFormContext },
          createElement(TestComponent)
        )
      )
    })

    expect(mockFormContext.field).toHaveBeenCalledWith("name", undefined)
    expect(capturedField!.value).toBe("test-value")
  })
})

describe("useArrayField (React)", () => {
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
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })

  it("throws when used outside LiveFormContext", () => {
    const errors: Error[] = []

    function TestComponent() {
      try {
        useArrayField("items")
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
    expect(errors[0].message).toContain("useArrayField()")
    expect(errors[0].message).toContain("LiveFormContext")
  })
})
