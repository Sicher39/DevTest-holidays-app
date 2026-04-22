<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useDisplay } from 'vuetify/framework'
  import { DEFAULT_PAGE_TITLE, ROUTE_MENU_ITEMS, ROUTE_PATHS } from '@/router/routes'

  const drawer = ref(false)
  const route = useRoute()
  const { mdAndUp } = useDisplay()

  const pageTitle = computed(() => {
    return typeof route.meta.title === 'string' ? route.meta.title : DEFAULT_PAGE_TITLE
  })

  watch(() => route.fullPath, () => {
    drawer.value = false
  })
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="compact" elevation="1">
      <div class="flex w-full items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <router-link class="font-weight-bold text-white no-underline" :to="ROUTE_PATHS.dashboard">
            HM
          </router-link>
          <p>|</p>
          <p>{{ pageTitle }}</p>
        </div>

        <div class="flex items-center gap-2">
          <template v-if="mdAndUp">
            <router-link
              v-for="item in ROUTE_MENU_ITEMS"
              :key="item.to"
              v-slot="{ isActive }"
              class="no-underline"
              :to="item.to"
            >
              <v-btn
                class="px-2"
                :color="isActive ? 'active' : undefined"
                :prepend-icon="item.icon"
                rounded="lg"
                variant="plain"
              >
                {{ item.title }}
              </v-btn>
            </router-link>
          </template>

          <v-btn
            class="px-2"
            color="success"
            prepend-icon="mdi-invoice-text-plus"
            rounded="lg"
            :to="ROUTE_PATHS.requestCreate"
            variant="flat"
          >
            <span class="text-white">Nová žádost</span>
          </v-btn>

          <v-app-bar-nav-icon v-if="!mdAndUp" @click="drawer = !drawer" />
        </div>
      </div>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      location="right"
      temporary
    >
      <v-list class="px-2" density="comfortable" nav>
        <v-list-item
          v-for="item in ROUTE_MENU_ITEMS"
          :key="item.to"
          :prepend-icon="item.icon"
          rounded="lg"
          :title="item.title"
          :to="item.to"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
