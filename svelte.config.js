import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    prerender: {},
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        // 'unsafe-inline' is required because Svelte's `style:foo={bar}` directive
        // compiles to element-level style="..." attributes, which CSP hashes
        // do not cover. Script-src stays hash-only; this is style-only.
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'data:'],
        'connect-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['none'],
        'frame-ancestors': ['none']
      }
    }
  }
};
