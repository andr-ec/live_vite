import { test, expect } from "@playwright/test"
import { syncLV } from "../../utils.js"

test.describe("LiveVite Slot Non-ASCII Character Tests", () => {
  test("renders non-ASCII characters in slots correctly", async ({ page }) => {
    await page.goto("/slot-test")
    await syncLV(page)

    // Test 1: Polish characters
    const polishSlot = page.locator('[data-pw-label]:has-text("Polish")').locator('..').locator('[data-pw-slot]')
    await expect(polishSlot).toContainText("Zażółć gęślą jaźń")

    // Test 2: Japanese characters
    const japaneseSlot = page.locator('[data-pw-label]:has-text("Japanese")').locator('..').locator('[data-pw-slot]')
    await expect(japaneseSlot).toContainText("こんにちは世界")

    // Test 3: Emoji
    const emojiSlot = page.locator('[data-pw-label]:has-text("Emoji")').locator('..').locator('[data-pw-slot]')
    await expect(emojiSlot).toContainText("Hello 🌍 World 🎉 Party 🚀")

    // Test 4: Mixed scripts (Russian, Chinese, Arabic)
    const mixedSlot = page.locator('[data-pw-label]:has-text("Mixed")').locator('..').locator('[data-pw-slot]')
    await expect(mixedSlot).toContainText("Привет мир!")
    await expect(mixedSlot).toContainText("你好世界!")
    await expect(mixedSlot).toContainText("مرحبا بالعالم")

    // Test 5: Special Latin characters
    const specialSlot = page.locator('[data-pw-label]:has-text("Special")').locator('..').locator('[data-pw-slot]')
    await expect(specialSlot).toContainText("Ñoño café résumé naïve")
  })
})
