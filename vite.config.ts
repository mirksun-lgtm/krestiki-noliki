import { defineConfig } from 'vite';

// Относительный base: сборка работает на любой поддиректории
// (GitHub Pages project-site, itch.io) без правок.
export default defineConfig({
  base: './',
});
