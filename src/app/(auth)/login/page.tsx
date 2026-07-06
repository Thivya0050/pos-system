"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isLoggedIn, setLoggedIn } from "@/lib/auth";

const VALID_EMAIL = "admin@pos.com";
const VALID_PASSWORD = "admin123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard");
    }
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (email === VALID_EMAIL && password === VALID_PASSWORD) {
        setLoggedIn();
        router.push("/dashboard");
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    }, 800);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4">
      <div className="card w-full max-w-[400px] p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0f0f0f]">POS System</h1>
          <p className="mt-1 text-sm text-[#6b7280]">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
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
              className="input-field disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[#0f0f0f]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
              className="input-field disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
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

          <p className="text-center text-xs text-[#9ca3af]">
            Demo: admin@pos.com / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
