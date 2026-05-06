<script setup lang="ts">
const isOpen = shallowRef(false)

const accountMenuRef = useTemplateRef('accountMenuRef')

onClickOutside(accountMenuRef, () => {
  isOpen.value = false
})

useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
})
</script>

<template>
  <div ref="accountMenuRef" class="relative flex min-w-28 justify-end">
    <ButtonBase
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="isOpen = !isOpen"
      class="border-none"
    >
      <span class="font-mono text-sm">
        {{ $t('account_menu.connect') }}
      </span>

      <span
        class="i-lucide:chevron-down w-3 h-3 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </ButtonBase>

    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isOpen" class="absolute inset-ie-0 top-full pt-2 w-72 z-50" role="menu">
        <div
          class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden px-1"
          @click="isOpen = false"
        >
          <PyPIAdminActions />
        </div>
      </div>
    </Transition>
  </div>
</template>
