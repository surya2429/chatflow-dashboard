import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const toPosix = (p) => p.split('\\').join('/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [toPosix(resolve(__dirname, 'index.html')), toPosix(resolve(__dirname, 'src/**/*.{js,jsx}'))],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover:   'rgb(var(--accent-hover) / <alpha-value>)',
          light:   'rgb(var(--accent-tint) / <alpha-value>)',
          50:      'rgb(var(--accent-tint) / <alpha-value>)',
          100:     'rgb(var(--accent-tint-2) / <alpha-value>)',
          200:     'rgb(var(--accent-mid) / <alpha-value>)',
          500:     'rgb(var(--accent) / <alpha-value>)',
          600:     'rgb(var(--accent-hover) / <alpha-value>)',
          700:     'rgb(var(--accent-deep) / <alpha-value>)',
        },
        sidebar: {
          bg:     '#ffffff',
          border: '#e8ecf0',
          active: 'rgb(var(--accent-tint) / <alpha-value>)',
          hover:  '#f5f7fa',
          text:   '#64748b',
          active_text: 'rgb(var(--accent) / <alpha-value>)',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card:    '#ffffff',
          border:  '#e2e8f0',
          hover:   '#f1f5f9',
        },
        wa: {
          green: '#25D366',
          dark:  '#128C7E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.12)',
        btn:   '0 1px 2px rgb(var(--accent) / 0.25)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'marquee-left':  'marqueeLeft 40s linear infinite',
        'marquee-right': 'marqueeRight 40s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        marqueeLeft:  { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        marqueeRight: { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
