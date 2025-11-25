/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/client/**/*.{js,ts,jsx,tsx}",
        "./node_modules/@openai/apps-sdk-ui/dist/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Manrope', 'sans-serif'],
                display: ['Outfit', 'sans-serif'],
            },
            colors: {
                cortex: {
                    bg: '#0f172a', // Slate 900
                    surface: '#1e293b', // Slate 800
                    border: '#334155', // Slate 700
                    text: '#f8fafc', // Slate 50
                    muted: '#94a3b8', // Slate 400
                    accent: '#3b82f6', // Blue 500
                    'accent-hover': '#2563eb', // Blue 600
                    success: '#10b981', // Emerald 500
                    warning: '#f59e0b', // Amber 500
                    danger: '#ef4444', // Red 500
                }
            }
        },
    },
    plugins: [],
}
