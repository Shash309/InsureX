import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#F8F6F1',
          secondary: '#F0EDE6',
        },
        ink: '#1A1A2E',
        blue: '#2563EB',
        gold: '#D97706',
        muted: '#6B7280',
        border: '#E5E0D8',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,26,46,0.06), 0 4px 16px rgba(26,26,46,0.04)',
        'card-hover': '0 8px 24px rgba(26,26,46,0.12)',
        glow: '0 0 0 3px rgba(37,99,235,0.15)',
      },
    },
  },
  plugins: [],
} satisfies Config
