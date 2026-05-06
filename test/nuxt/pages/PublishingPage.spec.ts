import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PublishingPage from '~/pages/publishing.vue'

describe('PublishingPage', () => {
  it('explains official PyPI publishing without asking for tokens', async () => {
    const wrapper = await mountSuspended(PublishingPage)

    expect(wrapper.text()).toContain('Publishing to PyPI')
    expect(wrapper.text()).toContain('Trusted Publishing')
    expect(wrapper.text()).toContain('No PyPI token is needed')
    expect(wrapper.text()).toContain('pypa/gh-action-pypi-publish@release/v1')
    expect(wrapper.text()).toContain('id-token: write')
    expect(wrapper.text()).not.toContain('PYPI_TOKEN')
  })
})
