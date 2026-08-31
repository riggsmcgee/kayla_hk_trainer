// Vite + Vitest config for @dojo/web.
// `base` is overridable so GitHub Pages CI can set VITE_BASE=/kayla-hk-trainer/
// while local dev serves from '/'.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    // Plain node by default: the storage module takes an injectable
    // Storage-like backend and the engine constants are pure data, so the
    // engine suite needs no DOM and starts faster without one. The few
    // component tests opt into jsdom per file with a
    // '// @vitest-environment jsdom' docblock.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
