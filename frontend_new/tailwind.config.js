/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lexis: {
          slate: '#1e293b',
          emerald: '#10b981',
          'emerald-dark': '#059669',
          gold: '#f59e0b',
          'gold-light': '#fcd34d',
          bg: '#f8fafc',
        },
        scrabble: {
          tile: '#f5e6c8',
          tileText: '#4a3728',
          tileBorder: '#d7c68a',
          green: '#0d9488',
        }
      },
      animation: {
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
        }
      }
    },
  },
  plugins: [],
}
