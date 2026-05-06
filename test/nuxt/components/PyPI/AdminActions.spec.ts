import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { PyPIAdminActions } from '#components'

describe('PyPIAdminActions', () => {
  it('shows only manage projects and publishing guide in the connect menu variant', async () => {
    const wrapper = await mountSuspended(PyPIAdminActions)

    expect(wrapper.text()).toContain('Manage projects')
    expect(wrapper.text()).toContain('Publishing guide')
    expect(wrapper.text()).not.toContain('Configure Trusted Publisher')
    expect(wrapper.text()).not.toContain('Create pending publisher')
    expect(wrapper.text()).not.toContain('Organizations')
    expect(wrapper.text()).not.toContain('npm CLI')
    expect(wrapper.text()).not.toContain('Atmosphere')
  })

  it('uses only contextual manage project and publishing guide actions when packageName is provided', async () => {
    const wrapper = await mountSuspended(PyPIAdminActions, {
      props: {
        packageName: 'requests',
        variant: 'contextual',
      },
    })

    const links = wrapper.findAll('a').map(link => link.attributes('href'))

    expect(links).toContain('https://pypi.org/manage/project/requests/')
    expect(links).toContain('/publishing')
    expect(wrapper.text()).not.toContain('Configure Trusted Publisher')
  })
})
