/**
 * router/index.ts
 *
 * Manual routes for ./src/pages/*.vue
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import Index from '@/pages/index.vue'
import NewRequest from '@/pages/newRequest.vue'
import Requests from '@/pages/requests.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Index,
    },
    {
      path: '/zadosti',
      component: Requests,
    },
    {
      path: '/zadosti/nova-zadost',
      component: NewRequest,
    },
  ],
})

export default router
