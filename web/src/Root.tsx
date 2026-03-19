import App from './App.tsx'
import { I18nContext, useI18nProvider } from './i18n.ts'

export default function Root() {
  const i18n = useI18nProvider()

  return (
    <I18nContext.Provider value={i18n}>
      <App />
    </I18nContext.Provider>
  )
}
