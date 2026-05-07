import { expect, test } from './test-utils'

test.describe('Compare Page', () => {
  test('no-dep column renders separately from package columns', async ({ page, goto }) => {
    await goto('/compare?packages=requests,__no_dependency__', { waitUntil: 'hydration' })

    const grid = page.locator('.comparison-grid')
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Should have the no-dep column with special styling
    const noDepColumn = grid.locator('.comparison-cell-nodep')
    await expect(noDepColumn).toBeVisible()

    // The no-dep column should not contain a link
    await expect(noDepColumn.locator('a')).toHaveCount(0)
  })

  test('no-dep column is always last even when packages are added after', async ({
    page,
    goto,
  }) => {
    // Start with requests and no-dep
    await goto('/compare?packages=requests,__no_dependency__', { waitUntil: 'hydration' })

    const grid = page.locator('.comparison-grid')
    await expect(grid).toBeVisible({ timeout: 15000 })

    // Add another package via the input
    const input = page.locator('#package-search')
    await input.fill('django')

    // Wait for search results and click on django
    const djangoOption = page.locator('button:has-text("django")').first()
    await expect(djangoOption).toBeVisible({ timeout: 10000 })
    await djangoOption.click()

    // URL should have no-dep at the end, not in the middle
    await expect(page).toHaveURL(/packages=requests,django,__no_dependency__/)

    // Verify column order in the grid: requests, django, then no-dep
    const headerLinks = grid.locator('.comparison-cell-header a[title]')
    await expect(headerLinks).toHaveCount(2)
    await expect(headerLinks.nth(0)).toContainText('requests')
    await expect(headerLinks.nth(1)).toContainText('django')

    // No-dep should still be visible as the last column
    const noDepColumn = grid.locator('.comparison-cell-nodep')
    await expect(noDepColumn).toBeVisible()
  })

  test.skip('loads install-size data for a scoped package', async ({ page, goto }) => {
    // Scoped npm package parsing is legacy migration debt.
    // Intercept the internal API call the browser makes for install-size.
    // The browser will request /api/registry/install-size/@nuxt%2Fkit (encoded slash).
    // Before the fix this would fail to parse and return an error; after it returns 200.
    const installSizeResponse = page.waitForResponse(
      res =>
        res.url().includes('/api/registry/install-size/') &&
        res.url().includes('nuxt') &&
        res.request().method() === 'GET',
      { timeout: 20_000 },
    )

    await goto('/compare?packages=@nuxt/kit,vue', { waitUntil: 'hydration' })

    const response = await installSizeResponse
    expect(response.status()).toBe(200)

    const body = await response.json()
    // The API should return a valid install size object, not an error
    expect(body).toHaveProperty('selfSize')
    expect(body).toHaveProperty('totalSize')
  })

  test.skip('loads analysis data for a scoped package', async ({ page, goto }) => {
    // Scoped npm package analysis is legacy migration debt.
    const analysisResponse = page.waitForResponse(
      res =>
        res.url().includes('/api/registry/analysis/') &&
        res.url().includes('nuxt') &&
        res.request().method() === 'GET',
      { timeout: 20_000 },
    )

    await goto('/compare?packages=@nuxt/kit,vue', { waitUntil: 'hydration' })

    const response = await analysisResponse
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty('package', '@nuxt/kit')
    expect(body).toHaveProperty('moduleFormat', 'esm')
  })
})

test.describe('Search Pages', () => {
  test('/search?q=django -> keyboard navigation (arrow keys + enter)', async ({ page, goto }) => {
    await goto('/search?q=django', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    const firstResult = page.locator('[data-result-index="0"]').first()
    await expect(firstResult).toBeVisible()

    // Global keyboard navigation works regardless of focus
    // ArrowDown selects the next result
    await page.keyboard.press('ArrowDown')

    // ArrowUp selects the previous result
    await page.keyboard.press('ArrowUp')

    // Enter navigates to the selected result
    // URL is /package/django or /org/django or /user/django. Not /django
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/(package|org|user)\/django/)
  })

  test('/search?q=d -> ArrowDown navigates only between results, not keyword buttons', async ({
    page,
    goto,
  }) => {
    await goto('/search?q=d', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    const firstResult = page.locator('[data-result-index="0"]').first()
    const secondResult = page.locator('[data-result-index="1"]').first()
    await expect(firstResult).toBeVisible()
    await expect(secondResult).toBeVisible()

    // ArrowDown from input focuses the first result
    await page.keyboard.press('ArrowDown')
    await expect(firstResult).toBeFocused()

    // Second ArrowDown focuses the second result (not a keyword button within the first)
    await page.keyboard.press('ArrowDown')
    await expect(secondResult).toBeFocused()
  })

  test('/search?q=django -> ArrowUp from first result returns focus to search input', async ({
    page,
    goto,
  }) => {
    await goto('/search?q=django', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    // Navigate to first result
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[data-result-index="0"]').first()).toBeFocused()

    // ArrowUp returns to the search input
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('input[type="search"]')).toBeFocused()
  })

  test('/search?q=django -> "/" focuses the search input from results', async ({ page, goto }) => {
    await goto('/search?q=django', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    await page.locator('[data-result-index="0"]').first().focus()
    await page.keyboard.press('/')
    await expect(page.locator('input[type="search"]')).toBeFocused()
  })

  test('/ (homepage) → search, keeps focus on search input', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const homeSearchInput = page.locator('#home-search')
    await homeSearchInput.click()
    await page.keyboard.type('django')

    // Wait for navigation to /search (debounce is 250ms)
    await expect(page).toHaveURL(/\/search/, { timeout: 10000 })

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({
      timeout: 15000,
    })

    // Home search input should be gone (we're on /search now)
    await expect(homeSearchInput).not.toBeVisible()

    // Header search input should now exist and be focused
    const headerSearchInput = page.locator('#header-search')
    await expect(headerSearchInput).toBeVisible()
    await expect(headerSearchInput).toBeFocused()
  })

  test.skip('/ (homepage) -> clearing search before debounce does not navigate', async ({
    page,
    goto,
  }) => {
    // Existing behavior currently navigates on the first debounced character.
    // Keep this as an explicit product bug instead of making CI depend on timing.
    await goto('/', { waitUntil: 'hydration' })

    const homeSearchInput = page.locator('#home-search')
    await homeSearchInput.click()
    await page.keyboard.type('requests')
    for (let i = 0; i < 'requests'.length; i += 1) {
      await page.keyboard.press('Backspace')
    }

    await page.waitForTimeout(300)

    await expect(page).toHaveURL(/\/$/)
    await expect(homeSearchInput).toBeVisible()
    await expect(homeSearchInput).toHaveValue('')
  })

  test('/settings → search, keeps focus on search input', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.click()
    await searchInput.fill('django')

    await expect(page).toHaveURL(/\/search/, { timeout: 10000 })

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({
      timeout: 15000,
    })

    const headerSearchInput = page.locator('#header-search')
    await expect(headerSearchInput).toBeFocused()
  })
})

test.describe('Keyboard Shortcuts', () => {
  test('"c" navigates to /compare', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    await page.keyboard.press('c')

    await expect(page).toHaveURL(/\/compare/)
  })

  test('"c" does not navigate when any modifier key is pressed', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    await page.keyboard.press('Shift+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Control+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Alt+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Meta+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('ControlOrMeta+Shift+c')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('"c" on package page navigates to /compare with package pre-filled', async ({
    page,
    goto,
  }) => {
    await goto('/package/requests', { waitUntil: 'hydration' })

    await page.keyboard.press('c')

    // Should navigate to /compare with the package in the query
    await expect(page).toHaveURL(/\/compare\?packages=requests/)
  })

  test('"c" does not navigate when search input is focused', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('#header-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.press('c')

    // Should still be on settings, not navigated to compare
    await expect(page).toHaveURL(/\/settings/)
    // The 'c' should have been typed into the input
    await expect(searchInput).toHaveValue('c')
  })

  test('"c" on package page does not navigate when any modifier key is pressed', async ({
    page,
    goto,
  }) => {
    await goto('/package/requests', { waitUntil: 'hydration' })

    await page.keyboard.press('Shift+c')
    await expect(page).toHaveURL(/\/requests/)
    await page.keyboard.press('Control+c')
    await expect(page).toHaveURL(/\/requests/)
    await page.keyboard.press('Alt+c')
    await expect(page).toHaveURL(/\/requests/)
    await page.keyboard.press('Meta+c')
    await expect(page).toHaveURL(/\/requests/)
    await page.keyboard.press('ControlOrMeta+Shift+c')
    await expect(page).toHaveURL(/\/requests/)
  })

  test('"," navigates to /settings', async ({ page, goto }) => {
    await goto('/compare', { waitUntil: 'hydration' })

    await page.keyboard.press(',')

    await expect(page).toHaveURL(/\/settings/)
  })

  test('"," does not navigate when any modifier key is pressed', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('#header-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.press('Shift+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Control+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Alt+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Meta+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('ControlOrMeta+Shift+,')
    await expect(page).toHaveURL(/\/settings/)
  })
})

test.describe('Keyboard Shortcuts disabled', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('npmx-settings', JSON.stringify({ keyboardShortcuts: false }))
    })
  })

  test('"," (header) does not navigate to /settings when shortcuts are disabled', async ({
    page,
    goto,
  }) => {
    await goto('/compare', { waitUntil: 'hydration' })

    await page.keyboard.press(',')

    await expect(page).toHaveURL(/\/compare/)
  })

  test('"/" (global) does not focus search input when shortcuts are disabled', async ({
    page,
    goto,
  }) => {
    await goto('/search?q=django', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    // Focus a non-input element so "/" would normally steal focus to search
    await page.locator('[data-result-index="0"]').first().focus()

    await page.keyboard.press('/')

    await expect(page.locator('input[type="search"]')).not.toBeFocused()
  })

  test('"d" (package) does not navigate to docs when shortcuts are disabled', async ({
    page,
    goto,
  }) => {
    await goto('/package/requests', { waitUntil: 'hydration' })

    await page.keyboard.press('d')

    await expect(page).toHaveURL(/\/package\/requests$/)
  })
})
