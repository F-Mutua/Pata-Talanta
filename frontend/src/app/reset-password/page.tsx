"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import AuthShell from "@/components/AuthShell";
import { ui } from "@/lib/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // The reset link signs the user in via /auth/callback. Without that
  // session the link was invalid or has expired.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setReady(user ? "ok" : "expired"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Your password must contain at least 8 characters.");
    if (password !== confirmPassword) return setError("Your passwords do not match.");

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      const isScout = data.user?.user_metadata?.role === "scout";
      router.push(isScout ? "/scout" : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Account recovery" title="Choose a new password">
      {ready === "checking" && <p className="mt-6 text-sm text-[#AEB5C0]">Checking your link…</p>}

      {ready === "expired" && (
        <div className="mt-6 space-y-4">
          <p className={ui.error}>
            This reset link is invalid or has expired. Reset links can only be used once.
          </p>
          <Link href="/forgot-password" className={`${ui.button} block text-center`}>
            Request a new link
          </Link>
        </div>
      )}

      {ready === "ok" && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={ui.input}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={ui.input}
              placeholder="Enter your new password again"
            />
          </div>
          {error && <p className={ui.error}>{error}</p>}
          <button type="submit" disabled={loading} className={`${ui.button} w-full`}>
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
