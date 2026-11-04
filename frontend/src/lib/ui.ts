// Shared class names so every app screen uses the same palette as the
// landing page and player dashboard.

export const ui = {
  page: "min-h-screen bg-[#17191D] text-white",
  container: "mx-auto max-w-6xl px-6 py-12",
  eyebrow: "text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]",
  h1: "mt-3 text-4xl font-black",
  lead: "mt-4 max-w-2xl leading-7 text-[#AEB5C0]",
  card: "rounded-xl border border-[#353941] bg-[#22252B] p-6",
  muted: "text-[#AEB5C0]",
  label: "mb-2 block text-sm text-[#AEB5C0]",
  input:
    "w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 text-white outline-none focus:border-[#F47721]",
  button:
    "rounded-lg bg-[#F47721] px-6 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:cursor-not-allowed disabled:opacity-50",
  buttonGhost:
    "rounded-lg border border-[#454A54] px-4 py-2 text-sm font-semibold text-[#D8DCE2] transition hover:border-[#F47721] hover:text-[#F47721] disabled:opacity-50",
  error:
    "rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300",
  success:
    "rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300",
  empty:
    "rounded-xl border border-dashed border-[#454A54] p-8 text-center text-[#AEB5C0]",
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

export function formatMeeting(r: {
  proposed_meeting_at: string | null;
  meeting_place: string | null;
}) {
  const when = r.proposed_meeting_at
    ? new Date(r.proposed_meeting_at).toLocaleString("en-KE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return [when, r.meeting_place].filter(Boolean).join(" · ") || null;
}
