import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

type Language = 'fr' | 'en' | 'it';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Load from localStorage, default to French
    const saved = localStorage.getItem('gasTransfer-language');
    return (saved as Language) || 'fr';
  });

  // Save language preference
  useEffect(() => {
    localStorage.setItem('gasTransfer-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found for language "${language}"`);
      // Fallback to English, then to the key itself
      let fallback: any = translations.en;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      value = typeof fallback === 'string' ? fallback : key;
    }
    
    // Replace parameters if provided
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(new RegExp(`{${param}}`, 'g'), String(val));
      });
    }
    
    return value;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};