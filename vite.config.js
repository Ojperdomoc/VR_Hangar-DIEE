import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages publishes this repository under /VR_Hangar-DIEE/;
  // local development and ordinary previews stay at the site root.
  base: process.env.GITHUB_PAGES === 'true' ? '/VR_Hangar-DIEE/' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    // Three.js makes up most of the intentionally compact, single-viewer bundle.
    chunkSizeWarningLimit: 600
  }
});
