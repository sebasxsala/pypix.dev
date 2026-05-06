import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { buildGlobalSearchQuery } from '~/composables/useGlobalSearch'

describe('useGlobalSearch', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNuxtData()
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
})
