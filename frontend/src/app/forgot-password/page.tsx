"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import AuthShell from "@/components/AuthShell";
import { ui } from "@/lib/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        {
          // The callback exchanges the emailed code for a session, then
          // opens the page where the new password is set.
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password">
      {sent ? (
        <div className="mt-6 space-y-4">
          <p className={ui.success}>
            If an account exists for <strong>{email.trim()}</strong>, we&apos;ve sent a link
            to reset your password. Check your inbox and spam folder.
          </p>
          <p className="text-sm text-[#AEB5C0]">
            The link expires after a short time. Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="font-semibold text-[#F47721] hover:underline"
            >
              Send again
            </button>
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-[#AEB5C0]">
            Enter the email you signed up with and we&apos;ll send you a link to choose a
            new password.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                className={ui.input}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className={ui.error}>{error}</p>}
            <button type="submit" disabled={loading} className={`${ui.button} w-full`}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-[#AEB5C0]">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-[#F47721] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
