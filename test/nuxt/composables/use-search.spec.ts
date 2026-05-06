import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, watchEffect } from 'vue'
import type { NpmSearchResponse } from '#shared/types/npm-registry'

const searchNpm = vi.fn()

mockNuxtImport('useNpmSearch', () => {
  return () => ({
    search: searchNpm,
    checkOrgExists: vi.fn(),
    checkUserExists: vi.fn(),
  })
})

mockNuxtImport('useAlgoliaSearch', () => {
  return () => ({
    search: vi.fn(),
    searchWithSuggestions: vi.fn(),
  })
})

function searchResponse(name: string): NpmSearchResponse {
  return {
    objects: [
      {
        package: {
          name,
          version: '1.0.0',
          description: `${name} package`,
          keywords: [],
          date: '2026-05-06T00:00:00.000Z',
          links: {},
        },
        searchScore: 1,
      },
    ],
    total: 1,
    time: '2026-05-06T00:00:00.000Z',
    isStale: false,
  }
}

describe('useSearch', () => {
  beforeEach(() => {
    searchNpm.mockReset()
    clearNuxtData()
  })

  it('clears stale results as soon as the query changes', async () => {
    const query = ref('requests')
    const displayedNames = ref<string[]>([])

    searchNpm.mockResolvedValueOnce(searchResponse('requests'))
    searchNpm.mockResolvedValueOnce({
      objects: [],
      total: 0,
      time: '2026-05-06T00:00:00.000Z',
      isStale: false,
    } satisfies NpmSearchResponse)

    const WrapperComponent = defineComponent({
      setup() {
        const { data } = useSearch(query, ref('npm'))

        watchEffect(() => {
          displayedNames.value = data.value?.objects.map(result => result.package.name) ?? []
        })

        return () => h('div', displayedNames.value.join(','))
      },
    })

    await mountSuspended(WrapperComponent)
    await flushPromises()

    expect(displayedNames.value).toEqual(['requests'])

    query.value = 'betriarst'
    await nextTick()

    expect(displayedNames.value).toEqual([])
  })
})
