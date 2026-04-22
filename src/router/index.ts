import { createRouter, createWebHistory } from 'vue-router'
import { buildDocumentTitle, DEFAULT_PAGE_TITLE, ROUTE_PATHS } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: ROUTE_PATHS.dashboard,
      name: 'dashboard',
      component: () => import('@/pages/index.vue'),
      meta: {
        title: 'Nástěnka',
      },
    },
    {
      path: ROUTE_PATHS.requests,
      name: 'requests',
      component: () => import('@/pages/requests.vue'),
      meta: {
        title: 'Žádosti',
      },
    },
    {
      path: ROUTE_PATHS.requestCreate,
      name: 'request-create',
      component: () => import('@/pages/newRequest.vue'),
      meta: {
        title: 'Nová žádost',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: ROUTE_PATHS.dashboard,
    },
  ],
})

router.afterEach(to => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : DEFAULT_PAGE_TITLE
  document.title = buildDocumentTitle(pageTitle)
})

export default router
