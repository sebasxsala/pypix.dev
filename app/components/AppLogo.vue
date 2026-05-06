<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 612 170"
    width="612"
    height="170"
    :class="class"
  >
    <title>{{ $t('alt_logo') }}</title>
    <g transform="translate(0 14.602)">
      <path d="m0.93476 97.205h24.081v23.693h-24.081z" fill="currentColor" />
      <path
        d="m103.12-9.2307-3.6211 10.246-46.309 131-3.6211 10.246h15.537l3.6211-10.246 11.717-33.148 38.211-108.1z"
        fill="var(--accent)"
      />
      <text
        x="174"
        y="120.898"
        fill="currentColor"
        font-family="Geist, ui-sans-serif, system-ui, sans-serif"
        font-size="132"
        font-weight="400"
        letter-spacing="0"
      >
        pypix
      </text>
    </g>
  </svg>
</template>
