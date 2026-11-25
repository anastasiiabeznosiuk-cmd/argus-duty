import { Theme } from '@carbon/react';
import '@carbon/styles/css/styles.css';
import '../src/styles.css';

// Глобальна обгортка каталогу компонентів: та сама тема Gray 100, що й у застосунку.
export const Provider = ({ children }) => (
  <Theme theme="g100" className="app-theme" style={{ padding: '1rem', minHeight: '100vh' }}>
    {children}
  </Theme>
);
