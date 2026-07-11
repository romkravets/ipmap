module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
        mono:    ['var(--font-mono)', 'ui-monospace'],
        display: ['var(--font-display)', 'serif'],
      },
    },
  },
  plugins: [],
}
