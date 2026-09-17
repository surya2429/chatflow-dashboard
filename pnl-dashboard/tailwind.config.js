import { fileURLToPath } from 'node:url'
import { dirname, resolve, sep } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// Tailwind's glob matcher wants forward slashes, and `sep` avoids a literal escape here.
const posix = (p) => p.split(sep).join('/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    posix(resolve(here, 'index.html')),
    posix(resolve(here, 'src/**/*.{js,jsx}')),
  ],
  theme: {
    extend: {
      colors: {
        // Navy is the ink — headings, primary buttons, active state. On a light theme it
        // does the work a dark chrome used to, so the two accents stay meaningful.
        navy: {
          50: '#f1f5fa', 100: '#e2eaf4', 200: '#c3d3e7', 300: '#93b0d1',
          400: '#5d85b4', 500: '#3a6396', 600: '#2a4c78', 700: '#1d3a5f',
          800: '#14283f', 900: '#0c2340', 950: '#071628',
        },
        // Orange is the call to action and the highlight.
        orange: {
          50: '#fff5f1', 100: '#ffe7dc', 200: '#ffc8b0', 300: '#ffa17c',
          400: '#ff7647', 500: '#f4511e', 600: '#dd3f0f', 700: '#b4320c',
        },
        amber: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,35,64,0.06), 0 1px 3px rgba(12,35,64,0.04)',
        pop: '0 12px 32px rgba(12,35,64,0.14)',
        modal: '0 24px 64px rgba(12,35,64,0.22)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        popIn: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fadeIn .18s ease-out',
        'slide-up': 'slideUp .22s cubic-bezier(.16,1,.3,1)',
        'pop-in': 'popIn .18s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
}
