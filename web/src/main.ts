import 'bootstrap/dist/css/bootstrap.min.css'
// Syncfusion Bootstrap 5.3 theme, one file per component (each file once, no index.css).
import '@syncfusion/ej2-bootstrap5.3-theme/styles/base/base.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/button/button.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/popup/popup.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/dialog/dialog.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/toast/toast.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/input/input.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/spinner/spinner.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/drop-down-base/drop-down-base.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/drop-down-list/drop-down-list.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/pager/pager.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/numerictextbox/numerictextbox.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/radio-button/radio-button.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/check-box/check-box.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/auto-complete/auto-complete.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/datepicker/datepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/calendar/calendar.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/datetimepicker/datetimepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/list-view/list-view.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/context-menu/context-menu.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/excel-filter/excel-filter.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/tooltip/tooltip.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/timepicker/timepicker.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/h-scroll/h-scroll.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/v-scroll/v-scroll.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/toolbar/toolbar.css'
import '@syncfusion/ej2-bootstrap5.3-theme/styles/grid/grid.css'
// Global styles and the Clarity City font, after the themes so their overrides win.
import './assets/app.css'

import { registerLicense } from '@syncfusion/ej2-base'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'
import { router } from './router'
import { useSessionStore } from './stores/session'

async function bootstrap(): Promise<void> {
  const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY
  if (licenseKey) registerLicense(licenseKey)

  await setLocale('es-MX')

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  // Starts reading the stored session (and any sign-in link in the URL) right away.
  void useSessionStore(pinia).init()
  app.use(router)
  app.mount('#app')
}

void bootstrap()
