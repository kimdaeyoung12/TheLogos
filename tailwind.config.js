/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./content/**/*.md",
        "./layouts/**/*.html",
        "./assets/**/*.js",
        "./themes/**/*.{html,js}"
    ],
    darkMode: 'class', // Manual toggling via 'dark' class on body/html
    theme: {
        extend: {
            colors: {
                // Mapping main.css slate palette
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                // Semantic Token Mapping
                religion: 'var(--color-religion)',
                philosophy: 'var(--color-philosophy)',
                engineering: 'var(--color-engineering)',
                writing: 'var(--color-writing)',

                primary: {
                    light: 'var(--light-accent)',
                    dark: 'var(--dark-accent)',
                    hover: 'var(--light-accent-hover)',
                },

                // New Design Colors
                "design-primary": "#135bec",
                "design-background-light": "#f6f6f8",
                "design-background-dark": "#101622",
                "design-card-dark": "#1c1f27",
                "design-text-subtle": "#9da6b9",
            },
            fontFamily: {
                sans: [
                    'Pretendard',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'system-ui',
                    'Roboto',
                    '"Helvetica Neue"',
                    '"Segoe UI"',
                    '"Apple SD Gothic Neo"',
                    '"Noto Sans KR"',
                    '"Malgun Gothic"',
                    'sans-serif'
                ],
                serif: [
                    '"Noto Serif KR"',
                    'Georgia',
                    '"Times New Roman"',
                    'serif'
                ],
                // New Design Fonts
                "display": ["Work Sans", "Noto Sans", "sans-serif"],
                "serif-title": ["Noto Serif", "serif"]
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
            },
            transitionProperty: {
                'height': 'height',
                'spacing': 'margin, padding',
            },
            animation: {
                'float-slow': 'float 8s ease-in-out infinite',
                'float-reverse': 'float-reverse 10s ease-in-out infinite',
                'spin-slow': 'spin 15s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-20px) rotate(5deg)' },
                },
                'float-reverse': {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(20px) rotate(-5deg)' },
                }
            }
        },
    },
    plugins: [],
}
