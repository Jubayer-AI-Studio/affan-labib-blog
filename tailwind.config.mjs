/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'paper-bg': '#FAF8F5',
        'night-bg': '#141416',
        'paper-surface': '#FFFFFF',
        'night-surface': '#1D1D21',
        'paper-text': '#111827',
        'night-text': '#EDE8E1',
        'paper-border': '#E5E7EB',
        'night-border': '#2C2C33',
        'paper-accent': '#9A3412',
        'night-accent': '#FB923C',
        'paper-muted': '#4B5563',
        'night-muted': '#9CA3AF'
      },
      fontFamily: {
        serif: ['Amiri', 'Kalpurush', 'SolaimanLipi', 'Georgia', 'serif'],
        sans: ['"Hind Siliguri"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'xs': '0 1px 3px 0 rgba(0, 0, 0, 0.07)'
      }
    }
  },
  plugins: []
};
