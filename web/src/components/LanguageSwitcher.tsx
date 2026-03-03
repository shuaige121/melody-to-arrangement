import { useI18n, LOCALE_LABELS } from '../i18n.ts';
import type { Locale } from '../i18n.ts';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <label className="lang-switcher">
      <span className="lang-switcher__label">Lang</span>
      <select
        className="lang-switcher__select"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}
