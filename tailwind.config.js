/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'frosted-bg-tslc': 'var(--frosted-bg-tslc)',
        'frosted-accent-tslc': 'var(--frosted-accent-tslc)',
        'frosted-bg': 'var(--frosted-bg)',
        'frosted-accent': 'var(--frosted-accent)',
        'light-frost': 'var(--light-frost)',
        'medium-frost': 'var(--medium-frost)',
        'frosted-bg-tslc-darker': 'var(--frosted-bg-tslc-darker)',
        'hard-frost': 'var(--hard-frost)',
        'hard-frost-tslc': 'var(--hard-frost-tslc)',
      }
    }
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
