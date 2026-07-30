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
          50: '#e6edf7',
          100: '#b3cce8',
          200: '#80abda',
          300: '#4d8acb',
          400: '#2669bd',
          500: '#003B7A',
          600: '#003066',
          700: '#002652',
          800: '#001b3d',
          900: '#001029',
        },
        accent: {
          50: '#fff8e6',
          100: '#ffeab3',
          200: '#ffdc80',
          300: '#ffce4d',
          400: '#ffc026',
          500: '#FFC300',
          600: '#cca000',
          700: '#997d00',
          800: '#665900',
          900: '#332d00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

