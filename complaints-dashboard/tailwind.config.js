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
        // The warm neutral ground and its hairlines. A toned paper rather than a cool
        // blue-grey, so the three status hues stay the only saturated thing on screen.
        bone: {
          50: '#faf9f5', 100: '#f4f3ee', 200: '#f1f0ea', 300: '#e7e5dc',
          400: '#e6e4db', 500: '#d3d0c4', 600: '#a8a69a', 700: '#6f6d63',
          800: '#56554d', 900: '#1b1a16',
        },
        // Ticket statuses. Validated as a set: every pair clears the colour-blind
        // separation floor and 3:1 contrast on white. Do not re-step them casually.
        status: {
          open:   '#eb6834',
          prog:   '#2a78d6',
          closed: '#199e70',
          reopen: '#d03b3b',
        },
      },
      fontFamily: {
        sans: ['Schibsted Grotesk', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,26,22,0.05)',
        lift: '0 1px 2px rgba(27,26,22,0.05), 0 14px 32px -14px rgba(27,26,22,0.22)',
      },
    },
  },
  plugins: [],
}
