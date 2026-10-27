import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const toPosix = (p) => p.split('\\').join('/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [toPosix(resolve(__dirname, 'index.html')), toPosix(resolve(__dirname, 'src/**/*.{js,jsx}'))],
  theme: {
    extend: {
      // The same tokens as the ChatFlow dashboard, so the moved screens look exactly as before.
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
        surface: {
          DEFAULT: '#f8fafc',
          card:    '#ffffff',
          border:  '#e2e8f0',
          hover:   '#f1f5f9',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: { modal: '0 20px 60px rgba(0,0,0,0.12)' },
      animation: { 'fade-in': 'fadeIn 0.2s ease-out' },
      keyframes: { fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } } },
    },
  },
  plugins: [],
}
