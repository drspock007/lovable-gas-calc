import React from 'react';
import { I18nProvider } from '@/i18n/context';
import { Calculator } from './Calculator';

const Index = () => {
  return (
    <I18nProvider>
      <Calculator />
    </I18nProvider>
  );
};

export default Index;
