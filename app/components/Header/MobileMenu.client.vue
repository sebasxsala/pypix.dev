<script setup lang="ts">
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import type { NavigationConfigWithGroups } from '~/types'

const isOpen = defineModel<boolean>('open', { default: false })
const { links } = defineProps<{
  links: NavigationConfigWithGroups
}>()

const { open: openCommandPalette } = useCommandPalette()

const navRef = useTemplateRef('navRef')
const { activate, deactivate } = useFocusTrap(navRef, { allowOutsideClick: true })

function closeMenu() {
  isOpen.value = false
}

function handleOpenCommandPalette() {
  closeMenu()
  nextTick(() => {
    openCommandPalette()
  })
}

// Close menu on route change
const route = useRoute()
watch(() => route.fullPath, closeMenu)

// Close on escape
onKeyStroke(
  e => isKeyWithoutModifiers(e, 'Escape') && isOpen.value,
  e => {
    isOpen.value = false
  },
)

// Prevent body scroll when menu is open
const isLocked = useScrollLock(document)
watch(isOpen, open => (isLocked.value = open))
watch(isOpen, open => (open ? nextTick(activate) : deactivate()))
onUnmounted(deactivate)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] sm:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('nav.mobile_menu')"
      >
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          :aria-label="$t('common.close')"
          @click="closeMenu"
        />

        <!-- Menu panel (slides in from right) -->
        <Transition
          enter-active-class="transition-transform duration-200"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-200"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <nav
            v-if="isOpen"
            ref="navRef"
            class="absolute inset-ie-0 top-0 bottom-0 w-72 bg-bg border-is border-border shadow-xl flex flex-col"
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-border">
              <span class="font-mono text-sm text-fg-muted">{{ $t('nav.menu') }}</span>
              <button
                type="button"
                class="p-2 -m-2 text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
                :aria-label="$t('common.close')"
                @click="closeMenu"
              >
                <span class="i-lucide:x w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <!-- Account section -->
            <div class="px-2 py-2">
              <span
                class="px-3 py-2 block font-mono text-xs text-fg-subtle uppercase tracking-wider"
              >
                {{ $t('account_menu.account') }}
              </span>

              <div @click="closeMenu">
                <PyPIAdminActions />
              </div>
            </div>

            <div class="px-2 py-2">
              <span
                class="px-3 py-2 block font-mono text-xs text-fg-subtle uppercase tracking-wider"
              >
                {{ $t('command_palette.title') }}
              </span>

              <ButtonBase
                class="w-full flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
                :aria-label="$t('shortcuts.command_palette')"
                @click="handleOpenCommandPalette"
              >
                <span class="w-5 h-5 rounded-full bg-bg-muted flex items-center justify-center">
                  <span class="i-lucide:command w-3 h-3 text-fg-muted" aria-hidden="true" />
                </span>
                <span class="flex-1">{{ $t('command_palette.quick_actions') }}</span>
              </ButtonBase>
            </div>

            <!-- Divider -->
            <div class="mx-4 my-2 border-t border-border" />

            <!-- Navigation links -->
            <div class="flex-1 overflow-y-auto overscroll-contain py-2">
              <template v-for="(group, index) in links">
                <div
                  v-if="group.type === 'separator'"
                  :key="`separator-${index}`"
                  class="mx-4 my-2 border-t border-border"
                />

                <div v-if="group.type === 'group'" :key="group.name" class="p-2">
                  <span
                    v-if="group.label"
                    class="px-3 py-2 font-mono text-xs text-fg-subtle uppercase tracking-wider"
                  >
                    {{ group.label }}
                  </span>
                  <div>
                    <NuxtLink
                      v-for="link in group.items"
                      :key="link.name"
                      :to="link.to"
                      :href="link.href"
                      :target="link.target"
                      class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                      @click="closeMenu"
                    >
                      <span
                        :class="link.iconClass"
                        class="w-5 h-5 text-fg-muted"
                        aria-hidden="true"
                      />
                      {{ link.label }}
                      <span
                        v-if="link.external"
                        class="i-lucide:external-link rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                        aria-hidden="true"
                      />
                    </NuxtLink>
                  </div>
                </div>
              </template>
            </div>
          </nav>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
