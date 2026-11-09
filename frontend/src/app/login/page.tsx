
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Role } from "@/lib/types";

const roles: { value: Role; title: string; description: string }[] = [
  { value: "player", title: "Player", description: "Go to my player dashboard" },
  { value: "scout", title: "Scout", description: "Go to the scout dashboard" },
];

export default function LoginPage() {
  const router = useRouter();

  // Only decides where to land. The account's real role still wins: the
  // dashboard sends scouts to /scout, and ScoutGate sends players back.
  const [role, setRole] = useState<Role>("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.push(role === "scout" ? "/scout" : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#17191D] px-6 py-16 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-2xl font-black tracking-wider text-white"
          >
            PATA <span className="text-[#F47721]">TALANTA</span>
          </Link>

          <Link
            href="/"
            className="text-sm text-[#AEB5C0] transition hover:text-[#F47721]"
          >
            ← Back to home
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-[#353941] bg-[#22252B] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F47721]">
            Welcome back
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Sign in to your account
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#AEB5C0]">
            Access your football profile and continue your Pata Talanta
            journey.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <fieldset>
              <legend className="mb-2 block text-sm">I am signing in as a</legend>
              <div className="grid grid-cols-2 gap-3">
                {roles.map((r) => (
                  <label
                    key={r.value}
                    className={`cursor-pointer rounded-lg border p-4 transition ${
                      role === r.value
                        ? "border-[#F47721] bg-[#F47721]/10"
                        : "border-[#454A54] hover:border-[#AEB5C0]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="sr-only"
                    />
                    <span className="block font-bold">{r.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#AEB5C0]">
                      {r.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm">
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-[#F47721] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#F47721] px-5 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#AEB5C0]">
            Don&apos;t have an account?{" "}
            <Link
              href={`/signup?role=${role}`}
              className="font-semibold text-[#F47721] hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-[#AEB5C0]">
          Bringing Champions Forward.
        </p>
      </div>
    </main>
  );
}
