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

// In a SPA the login is a fetch with no navigation, so the browser's heuristic
// for "a login happened" often misses. The Credential Management API lets us
// tell the browser explicitly, which reliably triggers the save-password prompt
// (Chromium). Other browsers fall back to the autocomplete attributes below.
async function saveBrowserCredential(id, password) {
  if (typeof window === "undefined" || !("PasswordCredential" in window)) return;
  try {
    const cred = new window.PasswordCredential({ id, name: id, password });
    await navigator.credentials.store(cred);
  } catch {
    // Unsupported or user declined — safe to ignore.
  }
}

export default function AuthScreen() {
  const { login, register, verifyEmail, resendCode } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [step, setStep] = useState("auth"); // "auth" | "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isRegister && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const id = email.trim();
      if (isRegister) {
        await register(id, password);
        // Account created; a code was emailed. Move to the verification step.
        setPendingEmail(id);
        setCode("");
        setInfo(`We sent a 6-digit code to ${id}.`);
        setStep("verify");
      } else {
        await login(id, password);
        await saveBrowserCredential(id, password);
      }
    } catch (err) {
      // Unverified login: backend re-sends a code and asks us to verify.
      if (err.status === 403 && err.data?.reason === "email_not_verified") {
        setPendingEmail(err.data.email || email.trim());
        setCode("");
        setInfo("Please verify your email — we sent you a new code.");
        setStep("verify");
      } else {
        setError(err.message || "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await verifyEmail(pendingEmail, code.trim());
      await saveBrowserCredential(pendingEmail, password);
      // On success the AuthProvider sets the user and this screen unmounts.
    } catch (err) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    try {
      await resendCode(pendingEmail);
      setInfo("A new code is on its way.");
    } catch {
      setInfo("A new code is on its way.");
    }
  };

  const backToAuth = () => {
    setStep("auth");
    setCode("");
    setError("");
    setInfo("");
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
            {step === "verify"
              ? "Enter the code we emailed you"
              : isRegister
                ? "Create an account to save your calculations"
                : "Sign in to access your saved calculations"}
          </p>
        </div>

        {step === "verify" && (
          <VerifyForm
            email={pendingEmail}
            code={code}
            setCode={setCode}
            onSubmit={submitCode}
            onResend={resend}
            onBack={backToAuth}
            submitting={submitting}
            error={error}
            info={info}
          />
        )}

        {step === "auth" && (
          <>
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
            name="email"
            id="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            // "username" is the token password managers pair with the password
            // field; the email address serves as the account username here.
            autoComplete="username"
          />
          <Field
            label="Password"
            type="password"
            name="password"
            id="password"
            value={password}
            onChange={setPassword}
            placeholder={isRegister ? "At least 8 characters" : "••••••••"}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          {isRegister && (
            <Field
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              value={confirm}
              onChange={setConfirm}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
          )}

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
            disabled={submitting || !email || !password || (isRegister && !confirm)}
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
              setConfirm("");
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
          </>
        )}
      </div>
    </div>
  );
}

// The 6-digit code entry step shown after registering (or when logging in with
// an unverified account).
function VerifyForm({ email, code, setCode, onSubmit, onResend, onBack, submitting, error, info }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}
    >
      {info && (
        <div style={{ fontSize: 12, color: C.textDim, fontFamily: mono, marginBottom: 14, textAlign: "center" }}>
          {info}
        </div>
      )}
      <label
        style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textDim, marginBottom: 6, fontFamily: mono }}
      >
        6-Digit Code
      </label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        style={{
          width: "100%",
          padding: "12px 14px",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "10px",
          textAlign: "center",
          fontFamily: mono,
          background: C.inputBg,
          border: `1.5px solid ${C.border}`,
          borderRadius: 10,
          color: C.text,
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />

      {error && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.red, fontFamily: mono, margin: "14px 0" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "12px",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: mono,
          background: C.accent,
          color: C.bg,
          border: "none",
          borderRadius: 10,
          cursor: submitting ? "default" : "pointer",
          opacity: submitting || code.length !== 6 ? 0.5 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {submitting ? "Verifying…" : "Verify email"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12, fontFamily: mono }}>
        <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontFamily: mono, fontSize: 12, padding: 0 }}>
          ← Back
        </button>
        <button type="button" onClick={onResend} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: mono, fontSize: 12, fontWeight: 600, padding: 0 }}>
          Resend code
        </button>
      </div>
    </form>
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
