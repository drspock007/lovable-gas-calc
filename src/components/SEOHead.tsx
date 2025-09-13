import React from 'react';
import { useI18n } from '@/i18n/context';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image,
  url
}) => {
  const { t, language } = useI18n();
  
  const seoTitle = title || t('appTitle');
  const seoDescription = description || t('appSubtitle');
  const seoImage = image || '/icon-512.png';
  const seoUrl = url || window.location.href;
  
  React.useEffect(() => {
    // Update document title
    document.title = seoTitle;
    
    // Update or create meta tags
    const updateMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    };
    
    // Basic meta tags
    updateMeta('description', seoDescription);
    updateMeta('robots', 'index, follow');
    updateMeta('language', language);
    updateMeta('author', 'Gas Transfer Calculator');
    
    // OpenGraph tags
    updateMeta('og:type', 'website', true);
    updateMeta('og:title', seoTitle, true);
    updateMeta('og:description', seoDescription, true);
    updateMeta('og:image', seoImage, true);
    updateMeta('og:url', seoUrl, true);
    updateMeta('og:site_name', t('appTitle'), true);
    updateMeta('og:locale', getOGLocale(language), true);
    
    // Twitter Card tags
    updateMeta('twitter:card', 'summary_large_image');
    updateMeta('twitter:title', seoTitle);
    updateMeta('twitter:description', seoDescription);
    updateMeta('twitter:image', seoImage);
    
    // Technical meta tags
    updateMeta('viewport', 'width=device-width, initial-scale=1.0');
    updateMeta('theme-color', '#2563eb');
    updateMeta('msapplication-TileColor', '#2563eb');
    
    // Structured data
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": seoTitle,
      "description": seoDescription,
      "url": seoUrl,
      "applicationCategory": "Engineering Calculator",
      "operatingSystem": "Web",
      "browserRequirements": "Requires JavaScript",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "Gas Transfer Calculator"
      },
      "inLanguage": [
        {
          "@type": "Language",
          "name": "French",
          "alternateName": "fr"
        },
        {
          "@type": "Language", 
          "name": "English",
          "alternateName": "en"
        },
        {
          "@type": "Language",
          "name": "Italian", 
          "alternateName": "it"
        }
      ]
    };
    
    // Update structured data
    let structuredScript = document.querySelector('script[type="application/ld+json"]');
    if (!structuredScript) {
      structuredScript = document.createElement('script');
      structuredScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(structuredScript);
    }
    structuredScript.textContent = JSON.stringify(structuredData);
    
    // Update html lang attribute
    document.documentElement.lang = language;
    
  }, [seoTitle, seoDescription, seoImage, seoUrl, language, t]);
  
  return null; // This component only manages meta tags
};

const getOGLocale = (language: string): string => {
  const locales = {
    fr: 'fr_FR',
    en: 'en_US', 
    it: 'it_IT'
  };
  return locales[language as keyof typeof locales] || 'en_US';
};

export default SEOHead;