// Vite + Vitest config for @dojo/web.
// `base` is overridable so GitHub Pages CI can set VITE_BASE=/kayla-hk-trainer/
// while local dev serves from '/'.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    // Plain node: the storage module takes an injectable Storage-like backend
    // and the engine constants are pure data, so no jsdom is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
