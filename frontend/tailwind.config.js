/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f1ff',
          100: '#e0e3ff',
          200: '#c7ccff',
          300: '#a5adff',
          400: '#8287ff',
          500: '#646cff',
          600: '#535bf2',
          700: '#4842de',
          800: '#3a36b3',
          900: '#32338d',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
