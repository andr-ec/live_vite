import { test, expect } from "@playwright/test"

test.describe("LiveVite Dead View Tests", () => {
  test("renders Vue component inside regular Phoenix controller view (dead view)", async ({
    page,
  }) => {
    // Navigate to the dead view page
    const response = await page.goto("/dead-view")

    // First check if the page loaded successfully (no 500 error)
    expect(response.status()).toBe(200)

    // Verify the server-rendered content from the controller
    await expect(page.locator("[data-pw-server-message]")).toHaveText("Hello from dead view!")

    // Wait for Vue to initialize and hydrate the component
    // In dead views, Vue still mounts via the VueHook initialization
    await page.waitForTimeout(500)

    // Verify the Vue component rendered correctly
    await expect(page.locator("[data-pw-dead-view]")).toBeVisible()
    await expect(page.locator("[data-pw-vue-message]")).toHaveText("Hello from dead view!")
  })

  test("renders React component inside regular Phoenix controller view (dead view)", async ({
    page,
  }) => {
    // Navigate to the React dead view page
    const response = await page.goto("/react-dead-view")

    // First check if the page loaded successfully (no 500 error)
    expect(response.status()).toBe(200)

    // Verify the server-rendered content from the controller
    await expect(page.locator("[data-pw-server-message]")).toHaveText("Hello from dead view!")

    // Wait for React to initialize and hydrate the component
    await page.waitForTimeout(500)

    // Verify the React component rendered correctly
    await expect(page.locator("[data-pw-dead-view-react]")).toBeVisible()
    await expect(page.locator("[data-pw-react-message]")).toHaveText("Hello from dead view!")
  })
})
