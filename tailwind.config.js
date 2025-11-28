/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        afrodex: {
          orange: '#FF8C00',
          'orange-light': '#FFA500',
          'orange-dark': '#FF6600',
          black: '#0a0a0a',
          'black-light': '#1a1a1a',
          'black-lighter': '#2a2a2a',
          neon: '#FF8C00',
        },
      },
      boxShadow: {
        'neon': '0 0 10px rgba(255, 140, 0, 0.5)',
        'neon-strong': '0 0 20px rgba(255, 140, 0, 0.8)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(255, 140, 0, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 140, 0, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
