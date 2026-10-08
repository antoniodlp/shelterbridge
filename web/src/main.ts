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

import { registerLicense } from '@syncfusion/ej2-base'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'

async function bootstrap(): Promise<void> {
  const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY
  if (licenseKey) registerLicense(licenseKey)

  await setLocale('es-MX')

  const app = createApp(App)
  app.use(i18n)
  app.mount('#app')
}

void bootstrap()
