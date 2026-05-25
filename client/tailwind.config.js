/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        green: 'var(--green)',
        terra: 'var(--terra)',
        sun: 'var(--sun)',
        'green-pale': 'var(--green-pale)',
        'terra-pale': 'var(--terra-pale)',
        line: 'var(--line)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
