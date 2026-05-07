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
    vi.unstubAllGlobals()
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

  it('aborts the previous package search when a newer query starts', async () => {
    const query = ref('')
    const signals: AbortSignal[] = []

    searchNpm.mockImplementation(async (q: string, _options: unknown, signal?: AbortSignal) => {
      if (signal) {
        signals.push(signal)
      }

      if (q === 'dj') {
        return await new Promise<NpmSearchResponse>((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Search aborted', 'AbortError')),
            { once: true },
          )
        })
      }

      return searchResponse(q)
    })

    const displayedNames = ref<string[]>([])

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

    query.value = 'dj'
    await nextTick()
    await vi.waitFor(() => expect(signals).toHaveLength(1))

    query.value = 'django'
    await nextTick()
    await flushPromises()

    expect(signals[0]?.aborted).toBe(true)
    expect(displayedNames.value).toEqual(['django'])
  })

  it('does not check package availability while loading search suggestions', async () => {
    const query = ref('django')
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)

    searchNpm.mockResolvedValue(searchResponse('django'))

    const WrapperComponent = defineComponent({
      setup() {
        useSearch(query, ref('npm'), {}, { suggestions: true })
        return () => h('div')
      },
    })

    await mountSuspended(WrapperComponent)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pypi/package/django',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
