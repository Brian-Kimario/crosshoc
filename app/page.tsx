import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Navigation */}
      <nav className="bg-[#1e2937] border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔀</div>
          <span className="font-bold text-2xl">SplitEasy</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="space-y-8 text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Stop fighting over bills.{' '}
            <span className="text-emerald-400">Start splitting easier.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            📸 Snap receipt → 🤖 Auto-split → 💸 Get paid instantly.
            Zero-friction expense splitting for roommates, trips, friends, and families.
          </p>
          <div className="flex gap-4 justify-center pt-8">
            <Link href="/register">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg rounded-3xl">
                Try Demo Group →
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-[#1e2937] rounded-3xl p-8 border border-slate-700">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-semibold mb-3">Snap & Share</h3>
            <p className="text-slate-400">
              Take a photo of any receipt and instantly share it with your group.
            </p>
          </div>
          <div className="bg-[#1e2937] rounded-3xl p-8 border border-slate-700">
            <div className="text-4xl mb-4">⚖️</div>
            <h3 className="text-xl font-semibold mb-3">Smart Splitting</h3>
            <p className="text-slate-400">
              Equal splits, custom percentages, or precise amounts. We calculate it all.
            </p>
          </div>
          <div className="bg-[#1e2937] rounded-3xl p-8 border border-slate-700">
            <div className="text-4xl mb-4">💸</div>
            <h3 className="text-xl font-semibold mb-3">Instant Settlements</h3>
            <p className="text-slate-400">
              See who owes what and settle instantly with a click. Drama-free payments.
            </p>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="text-center mt-20 pt-12 border-t border-slate-700">
          <p className="text-slate-400">
            ✨ Trusted by 10k+ roommates and travelers worldwide
          </p>
        </div>
      </section>
    </div>
  );
}
