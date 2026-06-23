import { redirect } from "next/navigation";
import { AuthService } from "@/app/api/services/authService";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardClient from "@/components/DashboardClient";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const user = await AuthService.getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-indigo-500 rounded-full filter blur-[128px] opacity-10"></div>
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-emerald-500 rounded-full filter blur-[128px] opacity-10"></div>

      {/* Header/Nav */}
      <header className="border-b border-white/5 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              <span className="inline sm:hidden">BearBull</span>
              <span className="hidden sm:inline">BearBull.ai Dashboard</span>
            </h1>
          </div>
          
          <DashboardHeader user={user} />
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 md:px-8 py-6 relative z-10">
        <DashboardClient user={user} />
      </main>
    </div>
  );
}
