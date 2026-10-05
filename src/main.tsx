import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/common/ErrorBoundary'
import { I18nProvider } from './i18n'
import './index.css'
import { initSiteTexts } from './content/siteText'

// Apply super-admin text overrides from the first paint on (cached, then refreshed from the server)
initSiteTexts()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
