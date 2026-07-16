import { StrictMode } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import SalaryCalculator from "./main.jsx";
import { AuthProvider, useAuth } from "./auth";
import AuthScreen from "./AuthScreen.jsx";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d0f11",
          color: "#7a8494",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Mono', monospace",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  return user ? <SalaryCalculator /> : <AuthScreen />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
