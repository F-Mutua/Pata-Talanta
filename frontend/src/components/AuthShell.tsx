import Link from "next/link";

/** Same frame as the login and signup pages. */
export default function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#17191D] px-6 py-16 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-black tracking-wider text-white">
            PATA <span className="text-[#F47721]">TALANTA</span>
          </Link>
          <Link href="/" className="text-sm text-[#AEB5C0] transition hover:text-[#F47721]">
            ← Back to home
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-[#353941] bg-[#22252B] p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#F47721]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold">{title}</h1>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-[#AEB5C0]">Bringing Champions Forward.</p>
      </div>
    </main>
  );
}
