import { test, expect } from "@playwright/test"
import { syncLV } from "../../utils.js"

test.describe("Mixed Framework (Vue + React in same LiveView)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mixed-framework")
    await syncLV(page)
  })

  test("both Vue and React components mount and display initial state", async ({ page }) => {
    await expect(page.locator("[data-pw-vue-counter]")).toHaveText("0")
    await expect(page.locator("[data-pw-react-counter]")).toHaveText("0")
  })

  test("Vue component can push events that update both components", async ({ page }) => {
    await page.locator("[data-pw-vue-increment]").click()
    await syncLV(page)

    await expect(page.locator("[data-pw-vue-counter]")).toHaveText("1")
    await expect(page.locator("[data-pw-react-counter]")).toHaveText("1")
  })

  test("React component can push events that update both components", async ({ page }) => {
    await page.locator("[data-pw-react-increment]").click()
    await syncLV(page)

    await expect(page.locator("[data-pw-vue-counter]")).toHaveText("1")
    await expect(page.locator("[data-pw-react-counter]")).toHaveText("1")
  })

  test("interleaved updates from both frameworks stay in sync", async ({ page }) => {
    await page.locator("[data-pw-vue-increment]").click()
    await syncLV(page)
    await page.locator("[data-pw-react-increment]").click()
    await syncLV(page)
    await page.locator("[data-pw-vue-increment]").click()
    await syncLV(page)

    await expect(page.locator("[data-pw-vue-counter]")).toHaveText("3")
    await expect(page.locator("[data-pw-react-counter]")).toHaveText("3")
  })
})
