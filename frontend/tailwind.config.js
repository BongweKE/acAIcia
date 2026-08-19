/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#0A1C14',
          900: '#0F291E', // main background
          850: '#123023',
          800: '#16382B', // surface background
          700: '#1C4737', // card background
          600: '#265C48',
          500: '#32775E',
          400: '#43997A',
        },
        emerald: {
          DEFAULT: '#10B981',
          accent: '#34D399',
          glow: 'rgba(16, 185, 129, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 15px -3px rgba(16, 185, 129, 0.3)',
        'glow-lg': '0 0 25px -5px rgba(16, 185, 129, 0.4)',
      },
    },
  },
  plugins: [],
};
