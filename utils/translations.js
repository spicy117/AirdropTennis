import enTranslations from '../translations/en';
import zhCNTranslations from '../translations/zh-CN';

const translations = {
  en: enTranslations,
  'zh-CN': zhCNTranslations,
};

export const getTranslation = (language, key) => {
  const translation = translations[language] || translations.en;
  return translation[key] || key;
};

export const t = (language, key, params = {}) => {
  let translation = getTranslation(language, key);
  
  // Replace params if provided
  Object.keys(params).forEach((paramKey) => {
    translation = translation.replace(`{{${paramKey}}}`, params[paramKey]);
  });
  
  return translation;
};
