"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut, User as UserIcon, Sun, Moon } from "lucide-react";

interface DashboardHeaderProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("bearbull_theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("bearbull_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const name = user.user_metadata?.full_name || user.email;
  const avatar = user.user_metadata?.avatar_url;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/40 border border-white/5">
        {avatar ? (
          <img src={avatar} alt={name || "User"} className="h-6 w-6 rounded-full" />
        ) : (
          <UserIcon className="h-4 w-4 text-indigo-400" />
        )}
        <span className="text-sm font-medium text-slate-300 hidden sm:inline">
          {name}
        </span>
      </div>

      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/20 hover:bg-slate-800/55 text-indigo-400 hover:text-indigo-300 transition-all duration-300 active:scale-[0.95] cursor-pointer flex items-center justify-center"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 bg-slate-800/20 hover:bg-slate-800/55 transition-all duration-300 active:scale-[0.98] cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
}
