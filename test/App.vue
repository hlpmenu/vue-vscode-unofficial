<script setup lang="ts">
import { ref } from "vue"
const msg = "Hello World"

msg = 2;
const count = ref(0)
</script>

<template>
  <h1>{{ msg }}</h1>
</template>
