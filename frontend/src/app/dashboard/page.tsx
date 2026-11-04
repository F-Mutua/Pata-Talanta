import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

const navigation = [
  {
    title: "My Player Profile",
    description: "Manage your personal football information.",
    href: "/dashboard/profile",
    icon: "01",
  },
  {
    title: "Club History",
    description: "Record your current and previous clubs.",
    href: "/dashboard/clubs",
    icon: "02",
  },
  {
    title: "Match History",
    description: "Log the matches you have played in.",
    href: "/dashboard/matches",
    icon: "03",
  },
  {
    title: "Performance",
    description: "Record statistics and view your heatmaps.",
    href: "/dashboard/performance",
    icon: "04",
  },
  {
    title: "Match Videos",
    description: "Upload footage for analysis and for scouts to review.",
    href: "/dashboard/videos",
    icon: "05",
  },
  {
    title: "Scout Requests",
    description: "Respond to scouts who want to get in touch.",
    href: "/dashboard/requests",
    icon: "06",
  },
];

export default function DashboardPage() {
  return (
    <main className="text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Session-dependent content streams in; reading cookies outside
            Suspense is a build error with cacheComponents enabled. */}
        <Suspense fallback={<p className="text-[#AEB5C0]">Loading your dashboard…</p>}>
          <DashboardContent />
        </Suspense>

        <section className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47721]">
            Your football journey
          </p>
          <h2 className="mt-2 text-2xl font-bold">Manage your player career</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {navigation.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-xl border border-[#353941] bg-[#22252B] p-6 transition hover:border-[#F47721] hover:bg-[#282C33]"
              >
                <div className="flex items-start justify-between">
                  <span className="text-sm font-black text-[#F47721]">{item.icon}</span>
                  <span className="text-xl text-[#AEB5C0] transition group-hover:translate-x-1 group-hover:text-[#F47721]">
                    →
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#AEB5C0]">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-[#353941] py-8">
          <p className="text-sm font-bold tracking-widest text-[#F47721]">
            BCF — BRINGING CHAMPIONS FORWARD
          </p>
          <p className="mt-2 text-sm text-[#AEB5C0]">Pata Talanta. Look closer. Discover talent.</p>
        </section>
      </div>
    </main>
  );
}

async function DashboardContent() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role, county, position, discoverable")
    .eq("id", user.id)
    .maybeSingle();

  // Scouts have an application row (approved or not); the scout area handles it.
  const { count: scoutApps } = await supabase
    .from("scout_applications")
    .select("id", { count: "exact", head: true })
    .eq("applicant_id", user.id);
  if (
    profile?.role === "scout" ||
    user.user_metadata?.role === "scout" ||
    (scoutApps ?? 0) > 0
  )
    redirect("/scout");

  const [{ count: pendingRequests }, { count: views }] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("player_id", user.id),
  ]);

  const missing = [profile?.display_name, profile?.county, profile?.position].filter(
    (v) => !v
  ).length;

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-[#353941] bg-[#22252B] p-8 md:p-12">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full border-[30px] border-[#F47721]/5" />
        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#F47721]">
            Player dashboard
          </p>
          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            Welcome back,
            <br />
            <span className="text-[#F47721]">{profile?.display_name || "Player"}.</span>
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-[#AEB5C0]">
            Your talent deserves to be seen. Build your football identity, document your
            journey and put your performance in front of the people looking for the next
            generation of champions.
          </p>

          {profile && !profile.discoverable ? (
            <p className="mt-6 rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-4 text-sm">
              <strong className="text-[#F47721]">Scouts can&apos;t see you yet.</strong> Turn on
              visibility in your profile when you&apos;re ready to be discovered.
            </p>
          ) : (
            !!views && (
              <p className="mt-6 text-sm text-[#AEB5C0]">
                Your profile has been viewed <strong className="text-white">{views}</strong> time
                {views === 1 ? "" : "s"} by verified scouts.
              </p>
            )
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {(missing > 0 || !profile?.discoverable) && (
              <Link
                href="/dashboard/profile"
                className="inline-flex rounded-lg bg-[#F47721] px-6 py-3 font-bold text-white transition hover:bg-[#DB6418]"
              >
                Complete my profile →
              </Link>
            )}
            {!!pendingRequests && pendingRequests > 0 && (
              <Link
                href="/dashboard/requests"
                className="inline-flex rounded-lg border border-[#F47721] px-6 py-3 font-bold text-[#F47721] transition hover:bg-[#F47721]/10"
              >
                {pendingRequests} new scout request{pendingRequests === 1 ? "" : "s"} →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47721]">
              Your information
            </p>
            <h2 className="mt-2 text-2xl font-bold">Player overview</h2>
          </div>
          <Link
            href="/dashboard/profile"
            className="text-sm font-semibold text-[#F47721] hover:underline"
          >
            Edit profile →
          </Link>
        </div>

        {profileError || !profile ? (
          <div className="rounded-xl border border-red-500/30 bg-[#22252B] p-6">
            We couldn&apos;t retrieve your profile. Please try again.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Full name", value: profile.display_name },
              { label: "County", value: profile.county },
              { label: "Playing position", value: profile.position },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#353941] bg-[#22252B] p-6">
                <p className="text-sm text-[#AEB5C0]">{item.label}</p>
                <h3 className="mt-3 text-xl font-bold">{item.value || "Not provided"}</h3>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
