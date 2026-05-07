import { expect, test } from './test-utils'

test.describe.skip('Package Page', () => {
  // This covered the old JavaScript package-manager selector. PyPI install
  // guidance needs separate interaction coverage for its Python controls.
  test('/requests -> package manager select dropdown works', async ({ page, goto }) => {
    await goto('/package/requests', { waitUntil: 'hydration' })

    await expect(page.locator('h1')).toContainText('requests', { timeout: 15000 })

    const packageManagerButton = page.locator('article button[aria-haspopup="listbox"]').first()
    await expect(packageManagerButton).toBeVisible()

    // Open dropdown
    await packageManagerButton.click()
    const packageManagerDropdown = page.locator('[data-testid="package-manager-dropdown"]')
    await expect(packageManagerDropdown).toBeVisible({ timeout: 5000 })

    // Arrow keys navigate the listbox
    await packageManagerButton.press('ArrowDown')
    const firstDescendant = await packageManagerDropdown.getAttribute('aria-activedescendant')
    await packageManagerButton.press('ArrowDown')
    const secondDescendant = await packageManagerDropdown.getAttribute('aria-activedescendant')
    expect(secondDescendant).not.toBe(firstDescendant)

    // Escape closes dropdown and returns focus
    await packageManagerButton.press('Escape')
    await expect(packageManagerDropdown).not.toBeVisible()
    await expect(packageManagerButton).toBeFocused()

    // Enter selects option and closes dropdown
    await packageManagerButton.click()
    await expect(packageManagerDropdown).toBeVisible({ timeout: 5000 })
    await packageManagerButton.press('ArrowDown')
    await packageManagerButton.press('Enter')
    await expect(packageManagerDropdown).not.toBeVisible()
  })
})
