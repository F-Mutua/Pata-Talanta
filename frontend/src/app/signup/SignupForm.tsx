
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Role } from "@/lib/types";

const roles: { value: Role; title: string; description: string }[] = [
  { value: "player", title: "Player", description: "Showcase my game and get discovered" },
  { value: "scout", title: "Scout", description: "Discover and contact emerging talent" },
];

export default function SignupForm() {
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(
    params.get("role") === "scout" ? "scout" : "player"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    data: {
      display_name: fullName.trim(),
      // Read by the handle_new_user trigger (see docs/frontend-schema.sql).
      role,
    },
  },
});

      if (error) {
        setError(error.message);
      } else if (data.session) {
        setMessage(
          "Your account has been created successfully. You can now sign in."
        );
      } else {
        setMessage(
          "Your signup was received. Please check your email for a confirmation link before signing in."
        );
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#17191D] px-6 py-16 text-white">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-2xl font-black tracking-wider text-white"
        >
          PATA <span className="text-[#F47721]">TALANTA</span>
        </Link>

        <div className="mt-10 rounded-2xl border border-[#353941] bg-[#22252B] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F47721]">
            Join the platform
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Create your account
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#AEB5C0]">
            {role === "scout"
              ? "Create your Pata Talanta account to search, assess and contact grassroots players."
              : "Create your Pata Talanta account to start building your football profile and making your talent visible."}
          </p>

          <form onSubmit={handleSignup} className="mt-8 space-y-5">
            <fieldset>
              <legend className="mb-2 block text-sm">I am joining as a</legend>
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
              <label htmlFor="fullName" className="mb-2 block text-sm">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]"
                placeholder="Enter your full name"
              />
            </div>

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
              <label htmlFor="password" className="mb-2 block text-sm">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]"
                placeholder="Enter your password again"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#F47721] px-5 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#AEB5C0]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#F47721] hover:underline"
            >
              Sign in
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
