import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { buildGlobalSearchQuery } from '~/composables/useGlobalSearch'

describe('useGlobalSearch', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNuxtData()
    useState<string>('search-query').value = ''
    useState<string>('committed-search-query').value = ''
    const { settings } = useSettings()
    settings.value.instantSearch = true
    settings.value.searchProvider = 'npm'
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not persist the inherited npm provider marker for PyPI search URLs', async () => {
    expect(buildGlobalSearchQuery({ p: 'npm', q: 'django', page: '2' }, 'requests')).toEqual({
      p: undefined,
      q: 'requests',
      page: '2',
    })
  })

  it('normalizes whitespace for the submitted PyPI package query', async () => {
    expect(buildGlobalSearchQuery({}, 'better ')).toEqual({
      q: 'better',
      p: undefined,
    })
    expect(buildGlobalSearchQuery({}, 'better auth')).toEqual({
      q: 'better-auth',
      p: undefined,
    })
    expect(buildGlobalSearchQuery({}, 'better  auth')).toEqual({
      q: 'better-auth',
      p: undefined,
    })
  })

  it('does not navigate from the homepage after an instant-search query is cleared', async () => {
    await navigateTo('/')

    let search: ReturnType<typeof useGlobalSearch> | null = null

    await mountSuspended(
      defineComponent({
        setup() {
          search = useGlobalSearch()
          return () => h('div')
        },
      }),
      { route: '/' },
    )

    vi.useFakeTimers()
    search!.model.value = 'requests'
    await nextTick()

    expect(useRoute().name).toBe('index')

    search!.model.value = ''
    await nextTick()
    await vi.advanceTimersByTimeAsync(150)

    expect(useRoute().name).toBe('index')
    expect(useRoute().query.q).toBeUndefined()
  })

  it('navigates immediately when instant search changes outside the search page', async () => {
    await navigateTo('/package/django')

    let search: ReturnType<typeof useGlobalSearch> | null = null

    await mountSuspended(
      defineComponent({
        setup() {
          search = useGlobalSearch('header')
          return () => h('div')
        },
      }),
      { route: '/package/django' },
    )

    search!.model.value = 'requests'
    await nextTick()

    await vi.waitFor(() => expect(useRoute().path).toBe('/search'))
    expect(useRoute().query.q).toBe('requests')
  })

  it('debounces the committed query while instant search is typing', async () => {
    await navigateTo('/')

    let search: ReturnType<typeof useGlobalSearch> | null = null

    await mountSuspended(
      defineComponent({
        setup() {
          search = useGlobalSearch()
          return () => h('div')
        },
      }),
      { route: '/' },
    )

    vi.useFakeTimers()
    search!.model.value = 'requests'
    await nextTick()

    expect(search!.committedModel.value).toBe('')

    await vi.advanceTimersByTimeAsync(100)

    expect(search!.committedModel.value).toBe('requests')
  })

  it('uses Algolia search when explicitly selected in settings', async () => {
    const { settings } = useSettings()
    settings.value.searchProvider = 'algolia'

    await navigateTo('/search?p=npm&q=requests')

    let search: ReturnType<typeof useGlobalSearch> | null = null

    await mountSuspended(
      defineComponent({
        setup() {
          search = useGlobalSearch()
          return () => h('div')
        },
      }),
      { route: '/search?p=npm&q=requests' },
    )

    expect(search!.provider.value).toBe('algolia')
  })
})
