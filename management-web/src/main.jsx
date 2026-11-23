import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { DateRangeProvider } from "./contexts/DateRangeContext.jsx";
import { FiltersProvider } from "./hooks/useFilters.jsx";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <DateRangeProvider>
          <FiltersProvider>
            <App />
          </FiltersProvider>
        </DateRangeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
