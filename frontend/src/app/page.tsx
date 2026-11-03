
const steps = [
  {
    number: "01",
    title: "Create your profile",
    description:
      "Players create a profile with their football background, position, playing experience and performance information.",
  },
  {
    number: "02",
    title: "Add match information",
    description:
      "Record match statistics and upload footage so performances can be analysed and transformed into structured insights.",
  },
  {
    number: "03",
    title: "Get discovered",
    description:
      "Scouts explore player profiles, compare performance indicators and identify emerging grassroots football talent.",
  },
];

const sampleStats = [
  { label: "Distance covered", value: "8.4", unit: "km" },
  { label: "Top speed", value: "27.6", unit: "km/h" },
  { label: "Sprints", value: "18", unit: "estimated" },
  { label: "Match appearances", value: "12", unit: "matches" },
];

function SearchLens({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="26" cy="26" r="18" stroke="#F47721" strokeWidth="5" />
      <path
        d="M39 39L56 56"
        stroke="#F47721"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M26 13L34 18V28L26 33L18 28V18L26 13Z"
        stroke="white"
        strokeWidth="1.8"
      />
      <path d="M18 18L34 28M34 18L18 28" stroke="white" strokeWidth="1.2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"
      stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function ScoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"
      stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5M8 10.5h5M10.5 8v5" strokeLinecap="round" />
    </svg>
  );
}

function PitchGraphic() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[470px] overflow-hidden rounded-full border border-white/10 bg-[#202329]">
      <div className="absolute inset-[8%] rounded-full border border-white/15" />
      <div className="absolute left-1/2 top-0 h-full border-l border-white/15" />
      <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      <div className="absolute left-[8%] top-[30%] h-[40%] w-[17%] border border-white/15" />
      <div className="absolute right-[8%] top-[30%] h-[40%] w-[17%] border border-white/15" />

      <div className="absolute left-[24%] top-[27%] h-3 w-3 rounded-full bg-white/80" />
      <div className="absolute left-[43%] top-[43%] h-3 w-3 rounded-full bg-[#F47721]" />
      <div className="absolute right-[27%] top-[35%] h-3 w-3 rounded-full bg-white/80" />
      <div className="absolute bottom-[27%] right-[34%] h-3 w-3 rounded-full bg-white/80" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 470 470"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M110 145L205 210L330 165L310 315"
          stroke="#F47721"
          strokeWidth="2"
          strokeDasharray="7 9"
          opacity=".8"
        />
        <circle cx="205" cy="210" r="55" stroke="#F47721" strokeWidth="2" opacity=".35" />
        <circle cx="205" cy="210" r="75" stroke="#F47721" strokeWidth="1" opacity=".2" />
      </svg>

      <div className="absolute left-[34%] top-[34%] flex h-[34%] w-[34%] items-center justify-center rounded-full border-[5px] border-[#F47721] bg-[#17191D]/90 shadow-[0_0_55px_rgba(244,119,33,0.25)]">
        <SearchLens size={105} />
      </div>

      <div className="absolute bottom-[12%] left-[8%] rounded-xl border border-white/10 bg-[#17191D]/90 px-4 py-3">
        <p className="text-xs text-[#AEB5C0]">Talent intelligence</p>
        <p className="mt-1 text-sm font-semibold text-white">Look beyond the score</p>
      </div>
    </div>
  );
}

function SampleHeatmap() {
  const intensities = [
    1, 1, 2, 2, 1, 0, 0, 0, 1, 2, 3, 3,
    0, 1, 2, 3, 3, 2, 1, 0, 1, 2, 3, 2,
    0, 1, 2, 3, 2, 1, 1, 0, 0, 1, 2, 2,
    0, 0, 1, 2, 2, 1, 0, 0, 0, 1, 1, 1,
  ];

  const intensityClasses = [
    "bg-white/5",
    "bg-[#F47721]/20",
    "bg-[#F47721]/50",
    "bg-[#F47721]/90",
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#202329] p-3">
      <div className="absolute inset-3 grid grid-cols-12 grid-rows-4 gap-1">
        {intensities.map((intensity, index) => (
          <div
            key={index}
            className={`rounded-sm ${intensityClasses[intensity]}`}
          />
        ))}
      </div>
      <div className="pointer-events-none relative aspect-[12/5]">
        <div className="absolute inset-0 border border-white/20" />
        <div className="absolute left-1/2 top-0 h-full border-l border-white/20" />
        <div className="absolute left-1/2 top-1/2 h-[45%] w-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function IntelligencePreview() {
  return (
    <section className="bg-[#17191D] px-6 py-24 text-white lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]">
            Inside the intelligence engine
          </p>
          <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
            More than a player profile.
            <span className="text-[#F47721]"> A clearer picture of performance.</span>
          </h2>
          <p className="mt-6 text-lg leading-8 text-[#AEB5C0]">
            Match footage and player performance information can be
            transformed into structured indicators that help scouts
            understand how a player performs on the pitch.
          </p>
          <ul className="mt-8 space-y-4 text-[#D8DCE2]">
            {[
              "Performance statistics and match history",
              "Movement insights and estimated distance covered",
              "Position and activity heatmaps",
              "Video-supported player assessment",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#F47721]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-6 text-[#AEB5C0]">
            Performance indicators are intended to support scouting decisions,
            not replace the judgement of coaches and scouts.
          </p>
        </div>

        {/* Illustrative dashboard preview */}
        <div className="rounded-2xl border border-white/10 bg-[#292D33] p-5 shadow-2xl sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F47721]/15 text-[#F47721]">
                <UserIcon />
              </div>
              <div>
                <p className="font-bold text-white">Sample player profile</p>
                <p className="text-xs text-[#AEB5C0]">Central midfielder · Illustrative data</p>
              </div>
            </div>
            <span className="rounded-full border border-[#F47721]/40 px-3 py-1.5 text-xs font-semibold text-[#F47721]">
              DEMO PREVIEW
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sampleStats.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-[#202329] p-4">
                <p className="text-xs leading-5 text-[#AEB5C0]">{stat.label}</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {stat.value}
                  <span className="ml-1 text-xs font-medium text-[#AEB5C0]">
                    {stat.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Activity heatmap</p>
                <span className="text-xs text-[#AEB5C0]">Pitch activity</span>
              </div>
              <SampleHeatmap />
              <p className="mt-2 text-xs text-[#AEB5C0]">
                Illustrative visualisation of player movement
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-bold">Match insights</p>
              <div className="space-y-3">
                <div className="rounded-xl bg-[#202329] p-4">
                  <p className="text-xs text-[#AEB5C0]">Match activity</p>
                  <p className="mt-2 text-sm font-bold text-white">Movement analysis</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[72%] rounded-full bg-[#F47721]" />
                  </div>
                </div>
                <div className="rounded-xl bg-[#202329] p-4">
                  <p className="text-xs text-[#AEB5C0]">Video review</p>
                  <p className="mt-2 text-sm font-bold text-white">Match footage</p>
                  <p className="mt-1 text-xs text-[#AEB5C0]">
                    Visual evidence for assessment
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-[#AEB5C0]">
            This is a design illustration, not a real player's analysed
            performance or a validated scouting score.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#17191D]">
      {/* Navigation */}
      <header className="absolute left-0 top-0 z-20 w-full border-b border-white/10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="/" className="flex items-center gap-3">
            <SearchLens size={42} />
            <span className="text-lg font-black tracking-[0.12em] text-white">
              PATA <span className="text-[#F47721]">TALANTA</span>
            </span>
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-white/75 md:flex">
            <a href="#home" className="transition hover:text-[#F47721]">Home</a>
            <a href="#about" className="transition hover:text-[#F47721]">About</a>
            <a href="#how-it-works" className="transition hover:text-[#F47721]">How it works</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="/login" className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:text-[#F47721] sm:inline-block">
              Log in
            </a>
            <a href="/signup" className="rounded-lg bg-[#F47721] px-5 py-3 text-sm font-bold text-[#17191D] transition hover:bg-white">
              Get started
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#17191D] px-6 pb-24 pt-36 text-white lg:px-10 lg:pb-32 lg:pt-44"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
          <div className="absolute -right-40 top-20 h-[650px] w-[650px] rounded-full border border-white" />
          <div className="absolute -right-24 top-36 h-[500px] w-[500px] rounded-full border border-white" />
          <div className="absolute right-0 top-0 h-full border-l border-white" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#F47721]/40 bg-[#F47721]/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-[#F47721]" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#F47721]">
                BCF · Bringing Champions Forward
              </span>
            </div>

            <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Look closer.
              <br />
              Discover <span className="text-[#F47721]">talent.</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-[#AEB5C0]">
              Pata Talanta transforms grassroots football match footage and
              player performance information into meaningful insights,
              helping players showcase their game and scouts discover
              emerging talent.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a href="/signup?role=player" className="inline-flex items-center gap-3 rounded-lg bg-[#F47721] px-6 py-4 font-bold text-[#17191D] transition hover:bg-white">
                Join as a player <ArrowIcon />
              </a>
              <a href="/signup?role=scout" className="inline-flex items-center gap-3 rounded-lg border border-white/20 px-6 py-4 font-semibold text-white transition hover:border-[#F47721] hover:text-[#F47721]">
                Join as a scout
              </a>
            </div>

            <p className="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-[#AEB5C0]">
              Grassroots football · Performance intelligence · Talent discovery
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <PitchGraphic />
            <div className="absolute -bottom-5 right-0 rounded-xl border border-white/10 bg-[#292D33] px-5 py-4 shadow-xl sm:-right-5">
              <p className="text-xs text-[#AEB5C0]">Our focus</p>
              <p className="mt-1 font-bold text-white">
                Potential deserves to be seen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]">
              Why Pata Talanta?
            </p>
            <h2 className="mt-5 max-w-xl text-4xl font-black leading-tight sm:text-5xl">
              Talent exists everywhere. Visibility does not.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-8 text-[#626A75]">
              Talented footballers are found across grassroots and community
              teams, but their performances are not always captured, organised
              or presented in a way that makes comparison possible.
            </p>
            <p className="mt-5 text-lg leading-8 text-[#626A75]">
              Pata Talanta bridges this gap by turning match footage and
              performance information into structured insights that help
              players showcase their abilities and scouts assess emerging
              talent.
            </p>
          </div>
        </div>
      </section>

      {/* Players and scouts */}
      <section className="bg-[#F4F5F6] px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]">
              Built for discovery
            </p>
            <h2 className="mt-4 text-4xl font-black sm:text-5xl">
              One platform. Two perspectives.
            </h2>
            <p className="mt-5 leading-7 text-[#626A75]">
              Giving players a way to showcase their progress and scouts a
              clearer way to discover emerging talent.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[#17191D] p-8 text-white sm:p-10">
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F47721]/15 text-[#F47721]">
                <UserIcon />
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F47721]">
                For players
              </p>
              <h3 className="mt-3 text-3xl font-black">Make your game visible.</h3>
              <p className="mt-5 leading-7 text-[#AEB5C0]">
                Create a profile, add your football background, record match
                performances and upload footage to build a clearer picture
                of your development.
              </p>
              <a href="/signup?role=player" className="mt-8 inline-flex items-center gap-3 font-bold text-[#F47721] hover:text-white">
                Join as a player <ArrowIcon />
              </a>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm sm:p-10">
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F47721]/10 text-[#F47721]">
                <ScoutIcon />
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F47721]">
                For scouts
              </p>
              <h3 className="mt-3 text-3xl font-black">Find beyond reputation.</h3>
              <p className="mt-5 leading-7 text-[#626A75]">
                Explore emerging players, search by relevant attributes,
                compare performance indicators and review match insights
                to support informed scouting decisions.
              </p>
              <a href="/signup?role=scout" className="mt-8 inline-flex items-center gap-3 font-bold text-[#F47721] hover:text-[#17191D]">
                Join as a scout <ArrowIcon />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#202329] px-6 py-24 text-white lg:px-10 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]">
              The player journey
            </p>
            <h2 className="mt-4 text-4xl font-black sm:text-5xl">
              From match performance to opportunity.
            </h2>
            <p className="mt-5 leading-8 text-[#AEB5C0]">
              Players contribute their information and match footage.
              Pata Talanta helps turn that information into insights that
              scouts can explore.
            </p>
          </div>

          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="border-t border-white/20 pt-7">
                <span className="text-sm font-black tracking-widest text-[#F47721]">
                  {step.number}
                </span>
                <h3 className="mt-5 text-2xl font-bold">{step.title}</h3>
                <p className="mt-4 leading-7 text-[#AEB5C0]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence engine and sample dashboard */}
      <IntelligencePreview />

      {/* Closing call to action */}
      <section className="bg-[#F47721] px-6 py-20 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#17191D]/70">
              BCF · Bringing Champions Forward
            </p>
            <h2 className="mt-3 text-4xl font-black text-[#17191D] sm:text-5xl">
              The next discovery starts here.
            </h2>
          </div>
          <a href="/signup" className="inline-flex shrink-0 items-center gap-3 rounded-lg bg-[#17191D] px-7 py-4 font-bold text-white transition hover:bg-white hover:text-[#17191D]">
            Get started <ArrowIcon />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#17191D] px-6 py-10 text-white lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <a href="/" className="flex items-center gap-3">
            <SearchLens size={36} />
            <span className="font-black tracking-[0.12em]">
              PATA <span className="text-[#F47721]">TALANTA</span>
            </span>
          </a>
          <p className="text-sm text-[#AEB5C0]">
            Look closer. Discover talent.
          </p>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 pt-6 text-xs text-[#AEB5C0] sm:flex-row sm:justify-between">
          <p>© 2026 Pata Talanta. All rights reserved.</p>
          <p>Built by BCF — Bringing Champions Forward.</p>
        </div>
      </footer>
    </main>
  );
}
