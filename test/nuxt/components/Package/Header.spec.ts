import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PackageHeader from '~/components/Package/Header.vue'

describe('PackageHeader', () => {
  it('keeps package identity and navigation visible while package metadata is loading', async () => {
    const component = await mountSuspended(PackageHeader, {
      props: {
        pkg: null,
        packageName: 'zod',
        resolvedVersion: '4.1.13',
        displayVersion: null,
        latestVersion: null,
        provenanceData: null,
        provenanceStatus: 'idle',
        page: 'docs',
        versionUrlPattern: '/package-docs/zod/v/{version}',
      },
    })

    expect(component.find('h1').text()).toContain('zod')
    expect(component.find('nav').text()).toContain('main')
    expect(component.find('nav').text()).toContain('docs')
    expect(component.find('nav').text()).toContain('code')
  })

  it('shows contextual official PyPI admin actions for the package', async () => {
    const wrapper = await mountSuspended(PackageHeader, {
      props: {
        pkg: null,
        packageName: 'requests',
        resolvedVersion: '2.32.3',
        displayVersion: null,
        latestVersion: null,
        provenanceData: null,
        provenanceStatus: 'idle',
        page: 'main',
        versionUrlPattern: '/package-docs/requests/v/{version}',
      },
    })

    expect(wrapper.text()).toContain('Manage project')
    expect(wrapper.text()).toContain('Publishing guide')
    expect(wrapper.text()).not.toContain('Configure Trusted Publisher')

    const links = wrapper.findAll('a').map(link => link.attributes('href'))
    expect(links).toContain('https://pypi.org/manage/project/requests/')
    expect(links).toContain('/publishing')
  })
})
