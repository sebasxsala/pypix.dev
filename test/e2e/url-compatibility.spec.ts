import { expect, test } from './test-utils'

test.describe('PyPI URL Compatibility', () => {
  test.describe('Package Pages', () => {
    test('/package/requests -> package page', async ({ page, goto }) => {
      await goto('/package/requests', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('requests')
      await expect(
        page
          .locator('[data-testid="version-selector-button"]')
          .locator('text=/\\d+\\.\\d+\\.\\d+/'),
      ).toBeVisible()
    })

    test('/package/django -> package page', async ({ page, goto }) => {
      await goto('/package/django', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('django')
    })

    test('/package/requests/v/2.32.5 -> specific version', async ({ page, goto }) => {
      await goto('/package/requests/v/2.32.5', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('requests')
      await expect(
        page.locator('[data-testid="version-selector-button"]').locator('text=2.32.5'),
      ).toBeVisible()
    })

    test('/package/nonexistent-pkg-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/package/nonexistent-pkg-12345', { waitUntil: 'domcontentloaded' })

      // Should show error state - look for the heading specifically
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible()
    })
  })

  test.describe('Search Pages', () => {
    test('/search?q=django -> search results', async ({ page, goto }) => {
      await goto('/search?q=django', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('input[type="search"]')).toHaveValue('django')
      await expect(page.locator('text=/found \\d+/i')).toBeVisible()
    })

    test('/search?q=fastapi -> search results', async ({ page, goto }) => {
      await goto('/search?q=fastapi', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('input[type="search"]')).toHaveValue('fastapi')
      await expect(page.locator('text=/found \\d+/i')).toBeVisible()
    })

    test('/search → empty search page', async ({ page, goto }) => {
      await goto('/search', { waitUntil: 'domcontentloaded' })

      // Should show empty state prompt
      await expect(page.locator('text=/start typing/i')).toBeVisible()
    })
  })

  test.describe('User Profile Pages', () => {
    test('/~qwerzl → user profile', async ({ page, goto }) => {
      await goto('/~qwerzl', { waitUntil: 'hydration' })

      // Should show username
      await expect(page.locator('h1')).toContainText('~qwerzl')

      await expect(page.locator('text=/\\d+\\s+public\\s+package/i').first()).toBeVisible({
        timeout: 15000,
      })
    })

    test('/~nonexistent-user-12345 → empty user handling', async ({ page, goto }) => {
      await goto('/~nonexistent-user-12345', { waitUntil: 'domcontentloaded' })

      // Should show username in header
      await expect(page.locator('h1')).toContainText('~nonexistent-user-12345')
      // Should show empty state message
      await expect(page.getByText('No public packages found for')).toBeVisible()
    })
  })

  test.describe('Organization Pages', () => {
    test('/org/nuxt → organization page', async ({ page, goto }) => {
      await goto('/org/nuxt', { waitUntil: 'domcontentloaded' })

      // Should show org name
      await expect(page.locator('h1')).toContainText('@nuxt')
      // Should show packages heading
      await expect(page.getByRole('heading', { name: 'Packages' })).toBeVisible()
    })

    test('/org/nonexistent-org-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/org/nonexistent-org-12345', { waitUntil: 'domcontentloaded' })

      // Should show 404 error page
      await expect(page.locator('h1')).toContainText('Organization not found')
    })
  })

  test.describe('Edge Cases', () => {
    test('package name with dots: /package/zope.interface', async ({ page, goto }) => {
      await goto('/package/zope.interface', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('zope.interface')
    })

    test('package name with hyphens: /package/charset-normalizer', async ({ page, goto }) => {
      await goto('/package/charset-normalizer', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('charset-normalizer')
    })
  })
})
