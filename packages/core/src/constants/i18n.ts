/** Idiomas suportados (seletor + cookie NEXT_LOCALE). Base traduzida: pt-BR. */
export const LOCALES = [
  { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: LocaleCode = 'pt-BR';
