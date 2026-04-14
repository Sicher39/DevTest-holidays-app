<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useDisplay } from 'vuetify/framework'

  const drawer = ref(false)
  const route = useRoute()
  const { mdAndUp } = useDisplay()

  const pageTitle = computed(() => {
    switch (route.name) {
      case 'requests': {
        return 'Leave Requests'
      }
      case 'request-detail': {
        return 'Request Detail'
      }
      case 'request-create': {
        return 'New Request'
      }
      default: {
        return 'nástěnka'
      }
    }
  })

  const menuItems = [
    {
      title: 'nástěnka',
      icon: 'mdi-calendar-text',
      to: '/',
    },
    {
      title: 'žádosti',
      icon: 'mdi-calendar-text',
      to: '/zadosti',
    },
  ]
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="compact" elevation="1">

      <v-app-bar-title class="d-flex align-center mx-4">
        <router-link class="app-title" to="/">
          HM
        </router-link>
        <span class="text-disabled">| </span>
        <span class="text-medium-emphasis"> {{ pageTitle }} </span>

      </v-app-bar-title>
      <v-spacer />
      <template v-if="mdAndUp">
        <router-link
          v-for="item in menuItems"
          :key="item.to"
          v-slot="{ isActive }"
          class="px-4"
          :to="item.to"
        >
          <v-btn
            class="mx-2 px-2"
            :color="isActive ? undefined : 'active'"
            variant="plain"
          >

            {{ item.title }}
          </v-btn>
        </router-link>
      </template>

      <v-btn
        class="px-2 mr-2"
        color="success"
        to="/zadosti/nova-zadost"
        variant="flat"
      >
        Nová žádost
      </v-btn>
      <!-- Mobile Icon   -->
      <v-app-bar-nav-icon v-if="!mdAndUp" @click="drawer = !drawer" />

    </v-app-bar>

    <!--    Mobile menu -->
    <v-navigation-drawer
      v-model="drawer"
      location="right"
      temporary
    >
      <v-list class="px-2" density="comfortable" nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.to"
          :prepend-icon="item.icon"
          rounded="lg"
          :title="item.title"
          :to="item.to"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>

      <router-view />

    </v-main>
  </v-app>
</template>
