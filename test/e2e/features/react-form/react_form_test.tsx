import { useLiveFormReact, type Form } from "live_vite"

type TestForm = {
  name: string
  email: string
  age: number
  acceptTerms: boolean
  newsletter: boolean
  preferences: string[]
  profile: {
    bio: string
    skills: string[]
  }
  items: Array<{
    title: string
    tags: string[]
  }>
}

export default function ReactFormTest({ form: serverForm }: { form: Form<TestForm> }) {
  const form = useLiveFormReact<TestForm>(serverForm, {
    changeEvent: "validate",
    submitEvent: "submit",
    debounceInMiliseconds: 300,
  })

  // Basic fields
  const nameField = form.field("name")
  const emailField = form.field("email")
  const ageField = form.field("age")

  // Checkbox fields
  const acceptTermsField = form.field("acceptTerms", { type: "checkbox" })
  const newsletterField = form.field("newsletter", { type: "checkbox" })

  // Multi-checkbox fields for preferences
  const emailPrefField = form.field("preferences", { type: "checkbox", value: "email" })
  const smsPrefField = form.field("preferences", { type: "checkbox", value: "sms" })
  const pushPrefField = form.field("preferences", { type: "checkbox", value: "push" })

  // Nested object fields
  const profileField = form.field("profile")
  const bioField = profileField.field("bio")

  // Array fields
  const skillsArray = form.fieldArray("profile.skills")
  const itemsArray = form.fieldArray("items")

  const submitForm = async () => {
    try {
      await form.submit()
    } catch (error) {
      console.error("Form submission failed:", error)
    }
  }

  return (
    <div data-pw-form>
      <h1>React Form Test</h1>

      {/* Form State Display */}
      <div data-pw-form-state>
        <div data-pw-is-valid>Valid: {form.isValid ? "true" : "false"}</div>
        <div data-pw-is-dirty>Dirty: {form.isDirty ? "true" : "false"}</div>
        <div data-pw-is-touched>Touched: {form.isTouched ? "true" : "false"}</div>
      </div>

      {/* Basic Fields */}
      <div>
        <div>
          <label htmlFor={nameField.inputProps.id}>Name</label>
          <input
            {...nameField.inputProps}
            data-pw-name-input
            placeholder="Enter name"
          />
          {nameField.errorMessage && (
            <div data-pw-name-error>{nameField.errorMessage}</div>
          )}
        </div>

        <div>
          <label htmlFor={emailField.inputProps.id}>Email</label>
          <input
            {...emailField.inputProps}
            data-pw-email-input
            type="email"
            placeholder="Enter email"
          />
          {emailField.errorMessage && (
            <div data-pw-email-error>{emailField.errorMessage}</div>
          )}
        </div>

        <div>
          <label htmlFor={ageField.inputProps.id}>Age</label>
          <input
            {...ageField.inputProps}
            data-pw-age-input
            type="number"
            placeholder="Enter age"
          />
          {ageField.errorMessage && (
            <div data-pw-age-error>{ageField.errorMessage}</div>
          )}
        </div>
      </div>

      {/* Checkbox Fields */}
      <div>
        <h3>Checkboxes</h3>

        <div>
          <label>
            <input {...acceptTermsField.inputProps} data-pw-accept-terms />
            Accept Terms and Conditions
          </label>
          {acceptTermsField.errorMessage && (
            <div data-pw-accept-terms-error>{acceptTermsField.errorMessage}</div>
          )}
        </div>

        <div>
          <label>
            <input {...newsletterField.inputProps} data-pw-newsletter />
            Subscribe to Newsletter
          </label>
        </div>

        <div>
          <label>Preferences (select multiple)</label>
          <div>
            <label>
              <input {...emailPrefField.inputProps} data-pw-preferences-email />
              Email Notifications
            </label>
            <label>
              <input {...smsPrefField.inputProps} data-pw-preferences-sms />
              SMS Notifications
            </label>
            <label>
              <input {...pushPrefField.inputProps} data-pw-preferences-push />
              Push Notifications
            </label>
          </div>
          {emailPrefField.errorMessage && (
            <div data-pw-preferences-error>{emailPrefField.errorMessage}</div>
          )}
        </div>
      </div>

      {/* Nested Fields */}
      <div>
        <h3>Profile</h3>
        <div>
          <label htmlFor={bioField.inputProps.id}>Bio</label>
          <textarea
            {...bioField.inputProps}
            data-pw-bio-input
            placeholder="Enter bio"
            rows={3}
          />
          {bioField.errorMessage && (
            <div data-pw-bio-error>{bioField.errorMessage}</div>
          )}
        </div>
      </div>

      {/* Skills Array */}
      <div>
        <div>
          <h3>Skills</h3>
          <button onClick={() => skillsArray.add("")} data-pw-add-skill>Add Skill</button>
        </div>

        <div>
          {skillsArray.fields.map((skillField, index) => (
            <div key={index} data-pw-skill-item={index}>
              <input
                {...skillField.inputProps}
                data-pw-skill-input={index}
                placeholder="Enter skill"
              />
              <button onClick={() => skillsArray.remove(index)} data-pw-remove-skill={index}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Items Array with nested tags */}
      <div>
        <div>
          <h3>Items</h3>
          <button onClick={() => itemsArray.add({ title: "", tags: [] })} data-pw-add-item>
            Add Item
          </button>
        </div>

        <div>
          {itemsArray.fields.map((itemField, itemIndex) => (
            <div key={itemIndex} data-pw-item={itemIndex}>
              <div>
                <h4>Item {itemIndex + 1}</h4>
                <button
                  onClick={() => itemsArray.remove(itemIndex)}
                  data-pw-remove-item={itemIndex}
                >
                  Remove Item
                </button>
              </div>

              <div>
                <label>Title</label>
                <input
                  {...itemField.field("title").inputProps}
                  data-pw-item-title={itemIndex}
                  placeholder="Enter item title"
                />
                {itemField.field("title").errorMessage && (
                  <div>{itemField.field("title").errorMessage}</div>
                )}
              </div>

              {/* Tags for this item */}
              <div>
                <div>
                  <label>Tags</label>
                  <button
                    onClick={() => itemsArray.fieldArray(`[${itemIndex}].tags`).add("")}
                    data-pw-add-tag={itemIndex}
                  >
                    Add Tag
                  </button>
                </div>

                <div>
                  {itemField.fieldArray("tags").fields.map((tagField, tagIndex) => (
                    <div key={tagIndex} data-pw-tag-item={`${itemIndex}-${tagIndex}`}>
                      <input
                        {...tagField.inputProps}
                        data-pw-tag-input={`${itemIndex}-${tagIndex}`}
                        placeholder="Enter tag"
                      />
                      <button
                        onClick={() =>
                          itemsArray.fieldArray(`[${itemIndex}].tags`).remove(tagIndex)
                        }
                        data-pw-remove-tag={`${itemIndex}-${tagIndex}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div>
        <button onClick={() => form.reset()} data-pw-reset>Reset</button>
        <button onClick={submitForm} disabled={!form.isValid} data-pw-submit>Submit</button>
      </div>
    </div>
  )
}
