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
          'orange-light': '#FFA540',
          'orange-dark': '#E67A00',
          'orange-glow': 'rgba(255, 140, 0, 0.3)',
          black: '#0a0a0a',
          'black-light': '#121212',
          'black-lighter': '#1a1a1a',
          'black-card': '#151515',
          surface: '#1e1e1e',
        },
        trade: {
          buy: '#00D26A',
          'buy-dark': '#00B85C',
          sell: '#FF4757',
          'sell-dark': '#E63E4D',
        }
      },
      fontFamily: {
        'display': ['Outfit', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'neon': '0 0 20px rgba(255, 140, 0, 0.4)',
        'neon-strong': '0 0 30px rgba(255, 140, 0, 0.6)',
        'neon-subtle': '0 0 10px rgba(255, 140, 0, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(255, 140, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 140, 0, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(255, 140, 0, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(255, 140, 0, 0.6)' },
        },
        'glow': {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
