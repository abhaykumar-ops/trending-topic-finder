import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F4EE",
        ink: "#1B1B18",
        wire: "#C81E1E",
        desk: "#2B4570",
        fade: "#8A857A",
      },
      fontFamily: {
        headline: ["'Libre Caslon Text'", "Georgia", "serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
