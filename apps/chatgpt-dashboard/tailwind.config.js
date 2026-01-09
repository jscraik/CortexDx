/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/client/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@openai/apps-sdk-ui/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
