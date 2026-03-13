import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingPage } from "@/pages/LandingPage";
import "./index.css";

// Redirect logged-in users straight to the app
const hasToken = (() => {
  try {
    return !!localStorage.getItem("sleepassured_refresh_token");
  } catch {
    return false;
  }
})();

if (hasToken) {
  window.location.replace("/dashboard");
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LandingPage />
    </StrictMode>
  );
}
