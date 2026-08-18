/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca'
        }
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'blink': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } }
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'blink': 'blink 1s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
