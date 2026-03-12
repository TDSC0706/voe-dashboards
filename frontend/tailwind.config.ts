import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff5ff",
          100: "#dde8ff",
          200: "#b3ccff",
          300: "#80aaff",
          400: "#4d88ff",
          500: "#1760D3",  // Mekatronik primary blue
          600: "#1452B8",
          700: "#0F3D99",
          800: "#0B2E7A",
          900: "#0A1F56",  // sidebar dark navy
          950: "#06112E",
        },
      },
    },
  },
  plugins: [],
};
export default config;
