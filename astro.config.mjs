import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import cloudflare from '@astrojs/cloudflare';

const isCloudflare =
  process.env.CF_PAGES === '1' ||
  process.env.ADAPTER === 'cloudflare' ||
  process.env.OUTPUT_ADAPTER === 'cloudflare';

// https://astro.build/config
export default defineConfig({
  site: isCloudflare ? 'https://affan-labib.pages.dev' : 'https://affan-labib-blog.vercel.app',
  output: 'server',
  adapter: isCloudflare
    ? cloudflare({
        imageService: 'passthrough'
      })
    : vercel(),
  integrations: [
    tailwind({
      applyBaseStyles: false
    })
  ]
});
