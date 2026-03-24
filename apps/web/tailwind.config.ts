import type { Config } from 'tailwindcss';

const config: Config = {
  // Dark mode: post-launch enhancement
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#2196F3',
        'primary-cyan': '#00BCD4',
        'dark-navy': '#0a1628',
        'text-dark': '#0f172a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
