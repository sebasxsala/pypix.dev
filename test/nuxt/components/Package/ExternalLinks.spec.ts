import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PackageExternalLinks from '~/components/Package/ExternalLinks.vue'

describe('PackageExternalLinks', () => {
  it('links Python packages to PyPI and Socket PyPI pages', async () => {
    const component = await mountSuspended(PackageExternalLinks, {
      props: {
        pkg: {
          '_id': 'requests',
          'name': 'requests',
          'dist-tags': { latest: '2.32.5' },
          'time': {},
          'requestedVersion': {
            name: 'requests',
            version: '2.32.5',
            dist: { tarball: '', shasum: '' },
          },
          'versions': {},
        } as SlimPackument,
      },
    })

    const hrefs = component.findAll('a').map(link => link.attributes('href'))

    expect(hrefs).toContain('https://socket.dev/pypi/package/requests')
    expect(hrefs).toContain('https://pypi.org/project/requests/')
    expect(hrefs).not.toContain('https://socket.dev/npm/package/requests')
    expect(hrefs).not.toContain('https://www.npmjs.com/package/requests')
  })
})
