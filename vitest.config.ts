import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The published @deepseek-ai client packages import their own CSS
    // Modules; process them instead of leaving the imports to Node.
    css: true,
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
