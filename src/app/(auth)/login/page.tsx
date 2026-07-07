"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pill, Shield, Users } from "lucide-react";
import { getSession, setSession } from "@/lib/auth";

const VALID_CREDENTIALS = [
  { email: "admin@pharmapos.com", password: "admin123" },
  { email: "admin@pos.com", password: "admin123" },
];

const features = [
  { icon: Pill, text: "Fast cashier with member pricing & promotions" },
  { icon: Users, text: "Member loyalty with tiered points & vouchers" },
  { icon: Shield, text: "Prescription tracking & branch management" },
];

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("Login attempt:", { email, password });
    setError("");
    setLoading(true);

    if (isValidLogin(email, password)) {
      setSession({
        isLoggedIn: true,
        role: "admin",
        name: "Admin",
        email: "admin@pharmapos.com",
      });
      window.location.href = "/dashboard";
      return;
    }

    setError("Invalid email or password");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-[#1e293b] p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Pill className="h-5 w-5" />
            </div>
            <span className="text-2xl font-semibold">PharmaPOS</span>
          </div>
          <p className="mt-6 max-w-sm text-slate-300">
            Modern pharmacy point of sale with member loyalty, promotions, and
            multi-branch support.
          </p>
        </div>
        <ul className="space-y-4">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
              <Icon className="h-4 w-4 shrink-0 text-blue-400" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-white px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Pill className="h-6 w-6 text-blue-600" />
              <span className="text-xl font-semibold text-[#0f172a]">PharmaPOS</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Sign in</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pharmapos.com"
                required
                disabled={loading}
                className="input-field disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0f172a]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="input-field disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
            <p className="text-center text-xs text-[#94a3b8]">
              Demo: admin@pharmapos.com / admin123
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
