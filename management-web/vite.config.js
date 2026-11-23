import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBaseUrl = env.VITE_API_BASE_URL;
  if (mode === "production" && !/^https:\/\//i.test(apiBaseUrl || "")) {
    throw new Error("Set VITE_API_BASE_URL to the HTTPS production API URL.");
  }
  return {
    plugins: [react()],
  };
});
