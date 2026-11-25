export default {
  stories: 'src/stories/**/*.stories.{js,jsx}',
  viteConfig: '.ladle/vite.config.mjs',
  defaultStory: 'datastate--data',
  addons: { theme: { enabled: false }, width: { enabled: true, options: { xsmall: 375, small: 768, medium: 1100, large: 1440 }, defaultState: 1440 } },
};
