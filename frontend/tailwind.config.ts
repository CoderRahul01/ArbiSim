import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:      '#0a0a0b',
        surface:   '#111113',
        elevated:  '#18181b',
        border:    '#27272a',
        'text-primary':   '#fafaf9',
        'text-secondary': '#a1a1aa',
        'text-tertiary':  '#71717a',
        coral:  '#e05c4b',
        amber:  '#f59e0b',
        teal:   '#14b8a6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      animation: {
        'fade-in':       'fadeIn 0.35s ease forwards',
        'slide-up':      'slideUp 0.35s ease forwards',
        'pulse-dot':     'pulseDot 1.4s ease-in-out infinite',
        'shimmer':       'shimmer 1.8s linear infinite',
        'spin-slow':     'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                                   to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(12px)' },   to: { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: { '0%, 100%': { opacity: '1' },                             '50%': { opacity: '0.3' } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' },                  '100%': { backgroundPosition: '200% 0' } },
        bounceSubtle: { '0%, 100%': { transform: 'translateY(0)' },           '50%': { transform: 'translateY(-4px)' } },
      },
    },
  },
  plugins: [],
};
export default config;
