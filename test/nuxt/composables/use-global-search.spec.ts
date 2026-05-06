import { beforeEach, describe, expect, it } from 'vitest'
import { buildGlobalSearchQuery } from '~/composables/useGlobalSearch'

describe('useGlobalSearch', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNuxtData()
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
})
