/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        tech:    { DEFAULT: '#3B82F6', light: '#BFDBFE', dark: '#1E3A8A' },
        finance: { DEFAULT: '#22C55E', light: '#BBF7D0', dark: '#14532D' },
        energy:  { DEFAULT: '#F97316', light: '#FED7AA', dark: '#7C2D12' },
        pharma:  { DEFAULT: '#EC4899', light: '#FBCFE8', dark: '#831843' },
        bull:    '#22C55E',
        bear:    '#EF4444',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
