import { test, expect } from "@playwright/test"
import { syncLV } from "../../utils.js"

test.describe("LiveVite React Stream Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/react-streams")
    await syncLV(page)
  })

  test("renders initial stream items", async ({ page }) => {
    await expect(page.locator('[data-testid="item-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).toBeVisible()

    await expect(page.locator('[data-testid="item-1"] [data-testid="item-name"]')).toHaveText("Item 1")
    await expect(page.locator('[data-testid="item-1"] [data-testid="item-description"]')).toHaveText("First item")
    await expect(page.locator('[data-testid="item-1"] [data-testid="item-id"]')).toHaveText("ID: 1")

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (3)")
  })

  test("adds new items to stream", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "New Item")
    await page.fill('[data-testid="description-input"]', "This is a new item")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-4"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("New Item")
    await expect(page.locator('[data-testid="item-4"] [data-testid="item-description"]')).toHaveText(
      "This is a new item"
    )
    await expect(page.locator('[data-testid="item-4"] [data-testid="item-id"]')).toHaveText("ID: 4")

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (4)")

    await expect(page.locator('[data-testid="name-input"]')).toHaveValue("")
    await expect(page.locator('[data-testid="description-input"]')).toHaveValue("")
  })

  test("adds multiple items in sequence", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "Item A")
    await page.fill('[data-testid="description-input"]', "Description A")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    await page.fill('[data-testid="name-input"]', "Item B")
    await page.fill('[data-testid="description-input"]', "Description B")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-4"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-5"]')).toBeVisible()

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (5)")
  })

  test("removes individual items from stream", async ({ page }) => {
    await page.click('[data-testid="remove-2"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).toBeVisible()

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (2)")
  })

  test("removes multiple items", async ({ page }) => {
    await page.click('[data-testid="remove-1"]')
    await syncLV(page)
    await page.click('[data-testid="remove-3"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-1"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).not.toBeVisible()

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (1)")
  })

  test("clears entire stream", async ({ page }) => {
    await page.click('[data-testid="clear-button"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-1"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).not.toBeVisible()

    await expect(page.locator('[data-testid="empty-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="empty-message"]')).toHaveText("No items in the stream")

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (0)")
  })

  test("resets stream to default state", async ({ page }) => {
    await page.click('[data-testid="clear-button"]')
    await syncLV(page)
    await expect(page.locator('[data-testid="empty-message"]')).toBeVisible()

    await page.click('[data-testid="reset-button"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).toBeVisible()
    await expect(page.locator('[data-testid="empty-message"]')).not.toBeVisible()

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (3)")
  })

  test("handles complex workflow: add, remove, clear, reset", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "Workflow Item")
    await page.fill('[data-testid="description-input"]', "Testing workflow")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (4)")

    await page.click('[data-testid="remove-2"]')
    await syncLV(page)
    await expect(itemsHeading).toHaveText("Items (3)")

    await page.click('[data-testid="clear-button"]')
    await syncLV(page)
    await expect(itemsHeading).toHaveText("Items (0)")
    await expect(page.locator('[data-testid="empty-message"]')).toBeVisible()

    await page.click('[data-testid="reset-button"]')
    await syncLV(page)
    await expect(itemsHeading).toHaveText("Items (3)")
    await expect(page.locator('[data-testid="empty-message"]')).not.toBeVisible()

    await expect(page.locator('[data-testid="item-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-3"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-4"]')).not.toBeVisible()
  })

  test("validates form input for adding items", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "")
    await page.fill('[data-testid="description-input"]', "Description only")

    page.on("dialog", async dialog => {
      expect(dialog.message()).toBe("Please enter a name for the item")
      await dialog.accept()
    })

    await page.click('[data-testid="add-button"]')

    await syncLV(page)
    const itemsHeading = page.locator('h3:has-text("Items")')
    await expect(itemsHeading).toHaveText("Items (3)")
  })

  test("maintains item order during operations", async ({ page }) => {
    const item1Name = await page.locator('[data-testid="item-1"] [data-testid="item-name"]').textContent()
    const item2Name = await page.locator('[data-testid="item-2"] [data-testid="item-name"]').textContent()
    const item3Name = await page.locator('[data-testid="item-3"] [data-testid="item-name"]').textContent()

    expect(item1Name).toBe("Item 1")
    expect(item2Name).toBe("Item 2")
    expect(item3Name).toBe("Item 3")

    await page.fill('[data-testid="name-input"]', "Item 4")
    await page.fill('[data-testid="description-input"]', "Fourth item")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    const item4Name = await page.locator('[data-testid="item-4"] [data-testid="item-name"]').textContent()
    expect(item4Name).toBe("Item 4")

    await page.click('[data-testid="remove-2"]')
    await syncLV(page)

    await expect(page.locator('[data-testid="item-1"] [data-testid="item-name"]')).toHaveText("Item 1")
    await expect(page.locator('[data-testid="item-3"] [data-testid="item-name"]')).toHaveText("Item 3")
    await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("Item 4")
  })

  test("maintains correct item order after stream reset", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "Extra Item")
    await page.fill('[data-testid="description-input"]', "Extra description")
    await page.click('[data-testid="add-button"]')
    await syncLV(page)

    await page.click('[data-testid="reset-button"]')
    await syncLV(page)

    const allItems = await page.locator('[data-testid="item-name"]').allTextContents()
    expect(allItems).toEqual(["Item 1", "Item 2", "Item 3"])

    await page.click('[data-testid="reset-button-at-0"]')
    await syncLV(page)

    const allReversedItems = await page.locator('[data-testid="item-name"]').allTextContents()
    expect(allReversedItems).toEqual(["Item 3", "Item 2", "Item 1"])
  })

  // Limit operation tests
  test.describe("Limit Operations", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/react-streams")
      await syncLV(page)
    })

    test("adds multiple items at start with positive limit", async ({ page }) => {
      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (3)")

      await page.click('[data-testid="add-multiple-start-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (5)")

      await expect(page.locator('[data-testid="item-6"] [data-testid="item-name"]')).toHaveText("Start Item C")
      await expect(page.locator('[data-testid="item-5"] [data-testid="item-name"]')).toHaveText("Start Item B")
      await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("Start Item A")
      await expect(page.locator('[data-testid="item-1"] [data-testid="item-name"]')).toHaveText("Item 1")
      await expect(page.locator('[data-testid="item-2"] [data-testid="item-name"]')).toHaveText("Item 2")

      await expect(page.locator('[data-testid="item-3"]')).not.toBeVisible()
    })

    test("adds multiple items at end with negative limit", async ({ page }) => {
      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (3)")

      await page.click('[data-testid="add-multiple-end-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (5)")

      await expect(page.locator('[data-testid="item-1"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="item-2"] [data-testid="item-name"]')).toHaveText("Item 2")
      await expect(page.locator('[data-testid="item-3"] [data-testid="item-name"]')).toHaveText("Item 3")
      await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("End Item X")
      await expect(page.locator('[data-testid="item-5"] [data-testid="item-name"]')).toHaveText("End Item Y")
      await expect(page.locator('[data-testid="item-6"] [data-testid="item-name"]')).toHaveText("End Item Z")
    })

    test("adds single item with custom positive limit", async ({ page }) => {
      await page.fill('[data-testid="positive-limit-input"]', "2")

      await page.click('[data-testid="add-positive-limit-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (2)")

      await expect(page.locator('[data-testid="item-1"] [data-testid="item-name"]')).toHaveText("Item 1")
      await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("Limited Item +2")

      await expect(page.locator('[data-testid="item-2"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="item-3"]')).not.toBeVisible()
    })

    test("adds single item with custom negative limit", async ({ page }) => {
      await page.fill('[data-testid="negative-limit-input"]', "2")

      await page.click('[data-testid="add-negative-limit-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (2)")

      await expect(page.locator('[data-testid="item-3"] [data-testid="item-name"]')).toHaveText("Item 3")
      await expect(page.locator('[data-testid="item-4"] [data-testid="item-name"]')).toHaveText("Limited Item -2")

      await expect(page.locator('[data-testid="item-1"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="item-2"]')).not.toBeVisible()
    })

    test("handles limit operations with existing items", async ({ page }) => {
      await page.fill('[data-testid="name-input"]', "Regular Item")
      await page.fill('[data-testid="description-input"]', "Regular description")
      await page.click('[data-testid="add-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (4)")

      await page.fill('[data-testid="positive-limit-input"]', "3")
      await page.click('[data-testid="add-positive-limit-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (3)")

      await expect(page.locator('[data-testid="item-5"] [data-testid="item-name"]')).toHaveText("Limited Item +3")
      await expect(page.locator('[data-testid="item-1"] [data-testid="item-name"]')).toHaveText("Item 1")
      await expect(page.locator('[data-testid="item-2"] [data-testid="item-name"]')).toHaveText("Item 2")
    })

    test("validates limit input constraints", async ({ page }) => {
      await expect(page.locator('[data-testid="add-positive-limit-button"]')).not.toBeDisabled()
      await expect(page.locator('[data-testid="add-negative-limit-button"]')).not.toBeDisabled()

      await page.fill('[data-testid="positive-limit-input"]', "")
      await page.fill('[data-testid="negative-limit-input"]', "")

      await expect(page.locator('[data-testid="add-positive-limit-button"]')).toBeDisabled()
      await expect(page.locator('[data-testid="add-negative-limit-button"]')).toBeDisabled()

      await page.fill('[data-testid="positive-limit-input"]', "0")
      await page.fill('[data-testid="negative-limit-input"]', "0")

      await expect(page.locator('[data-testid="add-positive-limit-button"]')).toBeDisabled()
      await expect(page.locator('[data-testid="add-negative-limit-button"]')).toBeDisabled()

      await page.fill('[data-testid="positive-limit-input"]', "3")
      await page.fill('[data-testid="negative-limit-input"]', "3")

      await expect(page.locator('[data-testid="add-positive-limit-button"]')).not.toBeDisabled()
      await expect(page.locator('[data-testid="add-negative-limit-button"]')).not.toBeDisabled()
    })

    test("handles limit operations in sequence", async ({ page }) => {
      await page.fill('[data-testid="positive-limit-input"]', "4")
      await page.click('[data-testid="add-positive-limit-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (4)")

      await page.fill('[data-testid="negative-limit-input"]', "2")
      await page.click('[data-testid="add-negative-limit-button"]')
      await syncLV(page)

      await expect(page.locator('h3:has-text("Items")')).toHaveText("Items (2)")

      await expect(page.locator('[data-testid="item-3"] [data-testid="item-name"]')).toHaveText("Item 3")
      await expect(page.locator('[data-testid="item-5"] [data-testid="item-name"]')).toHaveText("Limited Item -2")
    })
  })
})
