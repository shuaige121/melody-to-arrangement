import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App.tsx'
import { I18nContext, useI18nProvider } from './i18n.ts'

function Root() {
  const i18n = useI18nProvider();
  return (
    <I18nContext.Provider value={i18n}>
      <App />
    </I18nContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
