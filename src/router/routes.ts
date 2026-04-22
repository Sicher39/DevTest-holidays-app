export const APP_NAME = 'Holidays App'
export const DEFAULT_PAGE_TITLE = 'Nástěnka'

export const ROUTE_PATHS = {
  dashboard: '/',
  requests: '/zadosti',
  requestCreate: '/zadosti/nova-zadost',
} as const

export const ROUTE_MENU_ITEMS = [
  {
    title: 'Nástěnka',
    icon: 'mdi-bulletin-board',
    to: ROUTE_PATHS.dashboard,
  },
  {
    title: 'Žádosti',
    icon: 'mdi-calendar-text',
    to: ROUTE_PATHS.requests,
  },
] as const

export function buildDocumentTitle (pageTitle?: string): string {
  return pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME
}
