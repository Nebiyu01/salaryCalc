import { useState } from "react";
import { useAuth } from "./auth";

// Palette mirrors the calculator's dark theme (see main.jsx).
const C = {
  bg: "#0d0f11",
  surface: "#161a1f",
  inputBg: "#1c2127",
  border: "#2a3038",
  text: "#e8eaed",
  textDim: "#7a8494",
  accent: "#4ade80",
  red: "#f87171",
};
const mono = "'DM Mono', monospace";
const sans = "'DM Sans', system-ui, sans-serif";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) await register(email.trim(), password);
      else await login(email.trim(), password);
      // On success the AuthProvider sets the user and this screen unmounts.
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: sans,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#x1F4B0;</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
            Salary Calculator
          </h1>
          <p
            style={{
              fontSize: 13,
              color: C.textDim,
              margin: "8px 0 0",
              fontFamily: mono,
            }}
          >
            {isRegister
              ? "Create an account to save your calculations"
              : "Sign in to access your saved calculations"}
          </p>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 24,
          }}
        >
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isRegister ? "At least 8 characters" : "••••••••"}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />

          {error && (
            <div
              style={{
                background: "rgba(248,113,113,0.1)",
                border: `1px solid ${C.red}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                color: C.red,
                fontFamily: mono,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: mono,
              background: C.accent,
              color: C.bg,
              border: "none",
              borderRadius: 10,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting || !email || !password ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {submitting
              ? "Please wait…"
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 18,
            fontSize: 13,
            color: C.textDim,
            fontFamily: mono,
          }}
        >
          {isRegister ? "Already have an account?" : "No account yet?"}{" "}
          <button
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: C.accent,
              cursor: "pointer",
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >
            {isRegister ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: C.textDim,
          marginBottom: 6,
          fontFamily: mono,
        }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "11px 14px",
          fontSize: 15,
          fontFamily: mono,
          background: C.inputBg,
          border: `1.5px solid ${C.border}`,
          borderRadius: 10,
          color: C.text,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
        {...rest}
      />
    </div>
  );
}
