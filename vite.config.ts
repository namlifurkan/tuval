/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Which commit is actually being served. Build hosts expose it under different names, and a
// clone always has git, so the last resort is asking git directly.
const commit = (
  process.env.WORKERS_CI_COMMIT_SHA
  ?? process.env.CF_PAGES_COMMIT_SHA
  ?? process.env.GITHUB_SHA
  ?? (() => {
    try { return execSync('git rev-parse HEAD').toString().trim() } catch { return 'unknown' }
  })()
).slice(0, 40)

// A deploy that silently does not happen looks exactly like one that did. This file is what
// the deploy check polls for.
const stamp = {
  name: 'tuval-version-stamp',
  closeBundle() {
    mkdirSync('dist', { recursive: true })
    writeFileSync('dist/version.json', JSON.stringify({ commit }))
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stamp],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
    env: { VITE_COLLAB_URL: '' },
  },
})
