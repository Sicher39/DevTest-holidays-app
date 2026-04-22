<script setup lang="ts">
  withDefaults(defineProps<{
    title?: string
    subtitle?: string
  }>(), {
    title: '',
    subtitle: '',
  })
</script>

<template>
  <div class="mt-20 mb-6 w-full">
    <div>
      <h1 class="text-4xl font-bold text-center uppercase">
        {{ title }}
      </h1>
      <h2 v-if="subtitle" class="text-lg text-center">
        {{ subtitle }}
      </h2>
    </div>
  </div>
</template>
