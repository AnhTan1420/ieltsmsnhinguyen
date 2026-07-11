import AuthStatus from "@/components/auth/AuthStatus";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-7xl flex-col gap-12 px-6 py-16">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">IELTS Writing</p>
            <h1 className="mt-2 text-2xl font-bold">Practice & Grading Platform</h1>
          </div>
          <div className="flex gap-3">
            <AuthStatus />
            <Link href="/test/11111111-1111-4111-8111-111111111111" className="rounded-full bg-white px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-100">
              Student Portal
            </Link>
            <Link href="/teacher" className="rounded-full border border-white/20 px-5 py-2 font-semibold hover:bg-white/10">
              Teacher Portal
            </Link>
          </div>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-wrap gap-4">
              <Link href="/test/11111111-1111-4111-8111-111111111111" className="rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-bold text-slate-950 hover:bg-cyan-300">
                Start test
              </Link>
              <Link href="/teacher" className="rounded-2xl bg-white/10 px-8 py-4 text-lg font-bold hover:bg-white/15">
                Open dashboard
              </Link>
            </div>
          </div>
      </section>
    </main>
  );
}
