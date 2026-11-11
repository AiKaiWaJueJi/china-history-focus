/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06080a',
          900: '#0a0d12',
          850: '#0e1218',
          800: '#131922',
          700: '#1b232f',
          600: '#25303f',
        },
        gold: {
          DEFAULT: '#c9a227',
          soft: '#e2c87d',
          dim: '#8a7326',
        },
        bronze: '#9c6b3f',
        jade: '#4f8f7d',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', '"STSong"', 'SimSun', 'serif'],
        sans: ['"Noto Sans SC"', '"Microsoft YaHei"', '"PingFang SC"', 'sans-serif'],
      },
      boxShadow: {
        focus: '0 32px 80px -24px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,162,39,0.18)',
        panel: '0 18px 48px -20px rgba(0,0,0,0.85)',
      },
    },
  },
  plugins: [],
}
