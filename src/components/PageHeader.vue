<script setup lang="ts">

  const props = withDefaults(defineProps<{
    title?: string
    subtitle?: string
  }>(), {
    title: '',
    subtitle: '' })

</script>
<template>
  <div class="mb-6 w-full mt-20">
    <div class="block">
      <h1 class="text-4xl font-bold uppercase text-center">
        {{ props.title }}
      </h1>
      <h2 class="text-lg text-center">
        {{ props.subtitle }}
      </h2>
    </div>
  </div>
</template>
