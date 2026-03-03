import { useI18n, LOCALE_LABELS } from '../i18n.ts';
import type { Locale } from '../i18n.ts';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="lang-switcher">
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
        <button
          key={loc}
          className={`lang-switcher__btn ${loc === locale ? 'lang-switcher__btn--active' : ''}`}
          onClick={() => setLocale(loc)}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
