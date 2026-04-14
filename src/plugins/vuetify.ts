/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com
 */

import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import '../styles/layers.css'
import 'vuetify/styles'
export default createVuetify({
  theme: {
    defaultTheme: 'system',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          active: '#77b0ef',
          secondary: '#424242',
          success: '#4CAF50',
          error: '#FF5252',
        },
      },
      dark: {
        colors: {
          primary: '#64053b',
          active: '#a6a6a6',
          secondary: '#424242',
          success: '#4CAF50',
          error: '#FF5252',
        },
      },
    },
  },

  display: {
    mobileBreakpoint: 'md',
    thresholds: {
      xs: 0,
      sm: 600,
      md: 840,
      lg: 1145,
      xl: 1545,
      xxl: 2138,
    },
  },
})
