import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SettingsPage from '~/pages/settings.vue'

describe('settings page', () => {
  it('shows Python settings and hides npm-only settings', async () => {
    const wrapper = await mountSuspended(SettingsPage, { route: '/settings' })
    const text = wrapper.text()

    expect(text).toContain('Install commands')
    expect(text).toContain('Python installer')
    expect(text).toContain('Version style')
    expect(text).toContain('PyPI files')
    expect(text).toContain('File preference')
    expect(text).toContain('Data source')
    expect(text).toContain('Algolia search')

    expect(text).not.toContain('@types')
    expect(text).not.toContain('platform-specific packages')
  })
})
