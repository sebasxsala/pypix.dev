<script setup lang="ts">
import { noCorrect, noPasswordManager, restoreDoubleSpacePeriod } from '~/utils/input'

const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** @default 'md' */
    size?: 'sm' | 'md' | 'lg'
    /**
     * Prevents the browser from automatically modifying user input
     * (e.g. autocorrect, autocomplete, autocapitalize, and spellcheck).
     * @default true
     */
    noCorrect?: boolean
    /** Keyboard shortcut hint */
    ariaKeyshortcuts?: string
    /**
     * Prevents most common password managers from recognizing the input as a password field.
     * Note: This is not a standard HTML attribute but vendor-specific data-* attributes.
     * @default false
     */
    noPasswordManager?: boolean
  }>(),
  {
    size: 'md',
    noCorrect: true,
  },
)

const emit = defineEmits<{
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const el = useTemplateRef('el')
const previousInputValue = shallowRef(model.value)

const keyboardShortcutsEnabled = useKeyboardShortcuts()

function focus() {
  el.value?.focus()
}

function blur() {
  el.value?.blur()
}

defineExpose({
  focus,
  blur,
})

const inputAttrs = computed(() => ({
  ...(props.noCorrect ? noCorrect : {}),
  ...(props.noPasswordManager ? noPasswordManager : {}),
}))

watch(model, value => {
  previousInputValue.value = value
})

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = props.noCorrect
    ? restoreDoubleSpacePeriod(input.value, previousInputValue.value)
    : input.value

  if (value !== input.value) {
    input.value = value
  }

  previousInputValue.value = value
  model.value = value
}
</script>

<template>
  <input
    ref="el"
    :value="model"
    v-bind="inputAttrs"
    @input="handleInput"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
    class="appearance-none bg-bg-subtle border border-border font-mono text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 hover:border-fg-subtle outline-2 outline-transparent outline-offset-2 focus:border-accent focus-visible:outline-accent/70 disabled:(opacity-50 cursor-not-allowed)"
    :class="{
      'text-xs leading-[1.2] px-2 py-2 rounded-md': size === 'sm',
      'text-sm leading-none px-3 py-2.5 rounded-lg': size === 'md',
      'text-base leading-[1.4] px-6 py-4 rounded-xl': size === 'lg',
    }"
    :disabled="
      /** Catching Vue render-bug of invalid `disabled=false` attribute in the final HTML */
      disabled ? true : undefined
    "
    :aria-keyshortcuts="keyboardShortcutsEnabled ? ariaKeyshortcuts : undefined"
  />
</template>
