/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Poppins"', 'sans-serif'],
      },
      colors: {
        brand: {
          500: '#6366f1',
        },
        slate: {
          900: '#0f172a',
          800: '#1e293b',
        },
        indigo: {
          900: '#312e81',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
