import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { HeaderAccountMenu } from '#components'

describe('HeaderAccountMenu', () => {
  it('shows PyPI admin as the only connect destination', async () => {
    const wrapper = await mountSuspended(HeaderAccountMenu, {
      attachTo: document.body,
    })

    try {
      await wrapper.get('button[aria-haspopup="true"]').trigger('click')

      expect(wrapper.text()).toContain('Manage projects')
      expect(wrapper.text()).toContain('Publishing guide')
      expect(wrapper.text()).not.toContain('Configure Trusted Publisher')
      expect(wrapper.text()).not.toContain('Create pending publisher')
      expect(wrapper.text()).not.toContain('Organizations')
      expect(wrapper.text()).not.toContain('npm CLI')
      expect(wrapper.text()).not.toContain('Atmosphere')
    } finally {
      wrapper.unmount()
    }
  })
})
