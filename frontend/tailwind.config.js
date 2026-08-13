/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#0f6fde',
          600: '#0c5cb8',
          700: '#0a4a93',
          900: '#0a2a52',
        },
        // Public marketing site palette: a radiology light-box turned into a
        // brand — deep navy "box", cool cyan "film glow", and a brass plaque
        // accent for the 1954 heritage marks. Kept separate from `brand`
        // (the internal app's blue) so the two surfaces stay visually distinct.
        ink: {
          950: '#0a0f1c',
          900: '#0e1526',
          800: '#16203a',
          700: '#1f2c4d',
        },
        glow: {
          300: '#8fe0ea',
          400: '#5fd0dd',
          500: '#3fc1d0',
          600: '#2a9caa',
        },
        brass: {
          300: '#e6c98a',
          400: '#d9a75c',
          500: '#c08a3e',
          600: '#9c6b2a',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
