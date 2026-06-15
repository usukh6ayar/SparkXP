/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // SparkXP brand
        navy: '#182547',
        primary: '#F47B20',
        amber: '#FFB020',
        cream: '#FBF4E6',
      },
    },
  },
  plugins: [],
};

