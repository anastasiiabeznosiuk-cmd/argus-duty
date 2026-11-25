// Окрема конфігурація Vite для каталогу компонентів (Ladle збирає власним Vite 6).
export default {
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { exclude: ['maplibre-gl'] },
};
