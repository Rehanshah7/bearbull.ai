import Link from "next/link";
import { AuthService } from "@/app/api/services/authService";
import { ArrowRight, LayoutDashboard, LogIn, TrendingUp, Cpu, ShieldCheck } from "lucide-react";

export default async function Home() {
  const user = await AuthService.getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Decorative background glows */}
      <div className="absolute top-0 -left-4 w-[500px] h-[500px] bg-indigo-500 rounded-full filter blur-[128px] opacity-10 animate-pulse"></div>
      <div className="absolute bottom-0 -right-4 w-[500px] h-[500px] bg-emerald-500 rounded-full filter blur-[128px] opacity-10 animate-pulse"></div>

      <main className="relative z-10 max-w-4xl px-6 text-center space-y-8 py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold text-indigo-400">
          <TrendingUp className="h-4 w-4" /> Next.js 16 + Supabase MVC Architecture
        </div>

        {/* Hero Headline */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Analyze Markets with{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              BearBull.ai
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed">
            Instant stock quote lookup and 1-year daily historical analysis. Protected by robust, edge-compatible Supabase authentication.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              Go to Dashboard <LayoutDashboard className="h-5 w-5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              >
                Sign In <LogIn className="h-5 w-5" />
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-800/40 text-slate-200 font-bold transition-all duration-300 active:scale-[0.98]"
              >
                Create Free Account <ArrowRight className="h-5 w-5" />
              </Link>
            </>
          )}
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 max-w-3xl mx-auto">
          <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md text-left space-y-2.5">
            <Cpu className="h-8 w-8 text-indigo-400" />
            <h3 className="font-bold text-slate-200">MVC Architecture</h3>
            <p className="text-sm text-slate-400">Strictly structured using models, services, types, controllers, middleware, and routes.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md text-left space-y-2.5">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <h3 className="font-bold text-slate-200">Supabase Auth</h3>
            <p className="text-sm text-slate-400">Register and log in securely with standard Email/Password or single-click Google sign in.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md text-left space-y-2.5">
            <TrendingUp className="h-8 w-8 text-purple-400" />
            <h3 className="font-bold text-slate-200">Financial API</h3>
            <p className="text-sm text-slate-400">Built-in API endpoint querying real-time market quotes and historical daily datasets.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
