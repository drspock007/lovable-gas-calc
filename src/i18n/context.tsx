import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Translation } from './translations';

type Language = 'en' | 'fr' | 'it';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translation;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('gasCalculator_language');
    if (stored && ['en', 'fr', 'it'].includes(stored)) {
      return stored as Language;
    }
    // Detect browser language
    const browserLang = navigator.language.slice(0, 2);
    return ['en', 'fr', 'it'].includes(browserLang) ? browserLang as Language : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('gasCalculator_language', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};