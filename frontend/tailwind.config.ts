import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm dark surfaces (NOT #000) — Anthropic-adjacent editorial dark
        base:      '#1A1915',
        surface:   '#232220',
        elevated:  '#2B2A27',
        'surface-2': '#2F2D2A',
        // Hairline borders at low alpha text-on-dark
        border:    'rgba(245,243,238,0.10)',

        // Three text levels — contrast is currency
        'text-primary':   '#F5F3EE',     // warm off-white (NOT #fff)
        'text-secondary': 'rgba(245,243,238,0.66)',
        'text-tertiary':  'rgba(245,243,238,0.40)',

        // The one pop — Anthropic coral, used with restraint
        coral:        '#D97757',
        'coral-hover':'#E08A6C',
        'coral-muted':'rgba(217,119,87,0.14)',

        // Supporting accents — muted, on-brand
        amber:  '#D4A24C',
        teal:   '#6BA368',
        danger: '#C15F3C',   // on-brand rust (not fire-engine red)
        success:'#6BA368',   // muted sage
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono:  ['var(--font-mono)',  'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Major-third type scale, 1.250 ratio
        'display': ['3.815rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '500' }],
        'h1':      ['3.052rem', { lineHeight: '1.10', letterSpacing: '-0.02em', fontWeight: '500' }],
        'h2':      ['2.441rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3':      ['1.953rem', { lineHeight: '1.20', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.25rem',  { lineHeight: '1.60', letterSpacing: '0',       fontWeight: '400' }],
        'body':    ['1rem',     { lineHeight: '1.60', letterSpacing: '0',       fontWeight: '400' }],
        'small':   ['0.875rem', { lineHeight: '1.50', letterSpacing: '0',       fontWeight: '400' }],
        'mono':    ['0.9375rem',{ lineHeight: '1.50', letterSpacing: '0',       fontWeight: '400' }],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        'soft':   '0 1px 2px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.12)',
        'raised': '0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
        'coral':  '0 8px 24px rgba(217,119,87,0.18)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
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
