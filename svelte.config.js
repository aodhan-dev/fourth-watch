import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    }),
    prerender: {
      handleHttpError: ({ path, referrer: _referrer, message }) => {
        // Ignore missing favicon during prerender; it will be added in a later task
        if (path === '/favicon.png') {
          return;
        }
        throw new Error(message);
      }
    }
  }
};
