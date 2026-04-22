/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        slate: {
          900: '#0f172a',
          800: '#1e293b',
          900: '#0f172a',
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
