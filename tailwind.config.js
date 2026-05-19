/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#18202a',
        line: '#b8c0cc',
        field: '#f8fafc',
        active: '#0f766e',
      },
      fontFamily: {
        sans: ['"Yu Gothic UI"', '"Meiryo"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
