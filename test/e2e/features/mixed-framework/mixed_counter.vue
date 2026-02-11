<script setup lang="ts">
const props = defineProps<{ count: number }>()
</script>

<template>
  <div data-pw-vue-counter>{{ props.count }}</div>
  <button @click="$live.pushEvent('increment', { value: 1 })" data-pw-vue-increment>
    Vue +1
  </button>
</template>
