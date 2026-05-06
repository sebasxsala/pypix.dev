import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { PackageList } from '#components'
import type { NpmSearchResult } from '#shared/types/npm-registry'
import { DEFAULT_COLUMNS } from '#shared/types/preferences'

function result(name: string): NpmSearchResult {
  return {
    package: {
      name,
      version: '1.0.0',
      description: `${name} package`,
      keywords: [],
      date: '2026-05-06T00:00:00.000Z',
      links: {},
    },
    searchScore: 1,
  }
}

const visibleMaintainerColumns = DEFAULT_COLUMNS.map(column =>
  column.id === 'maintainers' ? { ...column, visible: true } : column,
)

describe('PackageList', () => {
  it('renders table results when the requested page is beyond the available results', async () => {
    const wrapper = await mountSuspended(PackageList, {
      props: {
        results: [result('better-auth'), result('better-auth-cli')],
        viewMode: 'table',
        columns: DEFAULT_COLUMNS,
        paginationMode: 'paginated',
        currentPage: 2,
        pageSize: 25,
      },
    })

    expect(wrapper.text()).toContain('better-auth')
    expect(wrapper.text()).toContain('better-auth-cli')
    expect(wrapper.emitted('pageChange')).toEqual([[1]])
  })

  it('renders PyPI maintainer text without a profile link when no username is available', async () => {
    const wrapper = await mountSuspended(PackageList, {
      props: {
        results: [
          {
            ...result('agent-better-auth'),
            package: {
              ...result('agent-better-auth').package,
              maintainers: [{ email: 'unknown@example.com' }],
            },
          },
        ],
        viewMode: 'table',
        columns: visibleMaintainerColumns,
      },
    })

    expect(wrapper.text()).toContain('unknown@example.com')
    expect(wrapper.findAll('a[href^="/~"]').length).toBe(0)
  })
})
