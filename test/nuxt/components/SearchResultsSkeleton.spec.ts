import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SearchResultsSkeleton from '~/components/SearchResultsSkeleton.vue'

describe('SearchResultsSkeleton', () => {
  it('renders toolbar, table, and pagination placeholders', async () => {
    const wrapper = await mountSuspended(SearchResultsSkeleton, {
      props: {
        viewMode: 'table',
        paginationMode: 'paginated',
      },
    })

    expect(wrapper.find('[data-testid="search-skeleton-toolbar"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="search-skeleton-row"]')).toHaveLength(10)
    expect(wrapper.find('[data-testid="search-skeleton-pagination"]').exists()).toBe(true)
  })
})
