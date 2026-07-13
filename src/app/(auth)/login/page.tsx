"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Loader2,
  Pill,
  Users,
  Zap,
} from "lucide-react";
import { getSession, setSession } from "@/lib/auth";
import "./login.css";

const VALID_CREDENTIALS = [
  { email: "admin@pharmapos.com", password: "admin123" },
  { email: "admin@pos.com", password: "admin123" },
];

const FEATURE_CHIPS = [
  { icon: Zap, label: "Fast cashier" },
  { icon: Users, label: "Member loyalty" },
  { icon: Building2, label: "Multi-branch" },
] as const;

function isValidLogin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return VALID_CREDENTIALS.some(
    (c) => c.email === normalizedEmail && c.password === password.trim()
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isValidLogin(email, password)) {
      setSession({
        isLoggedIn: true,
        role: "admin",
        name: "Admin",
        email: email.trim().toLowerCase(),
      });
      router.replace("/dashboard");
      return;
    }

    setError("Invalid email or password");
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-glow-blue" />
        <div className="login-bg-glow-teal" />
        <div className="login-bg-dots" />
        <span className="login-bg-rx login-bg-rx--tl">℞</span>
        <span className="login-bg-rx login-bg-rx--br">℞</span>
      </div>

      <div className="login-shell">
        <header className="login-topbar">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="login-brand-wordmark">
              <span className="login-brand-wordmark-pharma">Pharma</span>
              <span className="login-brand-wordmark-pos">POS</span>
            </span>
        </div>
      </header>

        <main className="login-main">
          <div className="login-column">
          <p className="login-eyebrow">PHARMACY DASHBOARD</p>
          <h1 className="login-headline">
            Welcome <span className="login-headline-accent">back</span>
          </h1>
          <p className="login-subhead">
            Sign in to manage sales, members, and inventory across your branches.
          </p>

          <div className="login-card">
            <div className="login-card-bar" aria-hidden="true" />
            <div className="login-demo-tag" aria-hidden="true">
              <span className="login-demo-tag-icon">+</span>
              <span className="login-demo-tag-label">Demo mode</span>
            </div>

            <form onSubmit={handleSubmit} noValidate className="login-form">
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pharmapos.com"
                  required
                  disabled={loading}
                  className="login-input"
                />
              </div>

              <div className="login-field">
                <label className="login-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="login-input"
                />
              </div>

              <div className="login-row">
                <label className="login-checkbox-label">
                  <input
                    type="checkbox"
                    className="login-checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    disabled={loading}
                  />
                  Keep me signed in
                </label>
                <button type="button" className="login-forgot">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <div className="login-divider">
                <span>DEMO CREDENTIALS</span>
              </div>
              <p className="login-demo-creds">
                admin@pharmapos.com
                <br />
                admin123
              </p>
            </form>
          </div>

          <div className="login-chips">
            {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
              <span key={label} className="login-chip">
                <Icon className="login-chip-icon h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
