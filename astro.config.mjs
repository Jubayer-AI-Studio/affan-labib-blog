import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://affan-labib-blog.vercel.app',
  integrations: [tailwind({
    applyBaseStyles: false
  })]
});
