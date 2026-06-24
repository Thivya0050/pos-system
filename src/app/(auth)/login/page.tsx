"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Store, Zap } from "lucide-react";
import { isLoggedIn, setLoggedIn } from "@/lib/auth";

const VALID_EMAIL = "admin@pos.com";
const VALID_PASSWORD = "admin123";

const features = [
  "Real-time sales tracking & inventory management",
  "Fast checkout with smart product search",
  "Detailed reports and analytics dashboard",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/pos");
    }
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (email === VALID_EMAIL && password === VALID_PASSWORD) {
        setLoggedIn();
        router.push("/pos");
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    }, 800);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-[#0a0a0a] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6366f1]">
            <Store className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">POS System</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Powerful POS for modern businesses
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Everything you need to run your store — sales, inventory, and
            insights in one place.
          </p>

          <ul className="mt-10 space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6366f1]" />
                <span className="text-gray-300">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-gray-600">
          Trusted by F&B and retail businesses across Malaysia
        </p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#6366f1]">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">POS System</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2 text-[#6366f1]">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Welcome back
              </span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Sign in</h2>
            <p className="mt-2 text-gray-500">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pos.com"
                required
                disabled={loading}
                className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
