"use client";

import { useEffect, useState } from "react";
import { 
  Calendar, 
  Coins, 
  Scissors, 
  TrendingUp, 
  Building2, 
  Rocket, 
  ArrowRight, 
  Loader2 
} from "lucide-react";
import { CorporateHubData } from "@/lib/gemini";

interface CorporateHubViewProps {
  onSelectTicker: (ticker: string) => void;
}

export default function CorporateHubView({ onSelectTicker }: CorporateHubViewProps) {
  const [data, setData] = useState<CorporateHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"actions" | "ipos">("actions");

  useEffect(() => {
    async function fetchHubData() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/market/corporate-hub");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load corporate hub data.");
        }
      } catch (err) {
        setError("Network error fetching upcoming corporate announcements.");
      } finally {
        setLoading(false);
      }
    }
    fetchHubData();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
      return new Date(dateStr).toLocaleDateString("en-IN", options);
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-12 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="text-slate-400 text-sm font-semibold">Retrieving upcoming Indian stock market events...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-3">
        <p className="text-red-400 text-sm font-bold">{error || "Data unavailable"}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-slate-900 text-xs text-slate-300 border border-white/10 hover:bg-slate-800 transition-all"
        >
          Retry Fetching
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
      
      {/* Header and Category Toggles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-extrabold text-slate-100">Indian Market Corporate Hub</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">Upcoming Dividends, Splits, Buybacks, and IPO Listings</p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab("actions")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "actions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Corporate Actions
          </button>
          <button
            onClick={() => setActiveSubTab("ipos")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "ipos"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            IPOs Center
          </button>
        </div>
      </div>

      {/* CORPORATE ACTIONS LISTINGS */}
      {activeSubTab === "actions" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Upcoming Dividends */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Coins className="h-4 w-4" />
              <span>Upcoming Dividends</span>
            </div>
            
            <div className="space-y-2">
              {data.upcomingDividends.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No scheduled upcoming dividends found.</p>
              ) : (
                data.upcomingDividends.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onSelectTicker(item.ticker)}
                    className="p-3.5 rounded-xl border border-white/5 bg-slate-950/20 hover:bg-slate-900/60 hover:border-indigo-500/30 transition-all cursor-pointer group flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-200 group-hover:text-indigo-400 transition-colors">{item.ticker}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.company}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>Ex-Date: {formatDate(item.exDate)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-emerald-400 block">{item.amount}</span>
                      <span className="text-[9px] text-indigo-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
                        View <ArrowRight className="h-2 w-2" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Buybacks */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Coins className="h-4 w-4" />
              <span>Upcoming Buybacks</span>
            </div>
            
            <div className="space-y-2">
              {data.upcomingBuybacks.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No scheduled upcoming buybacks found.</p>
              ) : (
                data.upcomingBuybacks.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onSelectTicker(item.ticker)}
                    className="p-3.5 rounded-xl border border-white/5 bg-slate-950/20 hover:bg-slate-900/60 hover:border-indigo-500/30 transition-all cursor-pointer group flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-200 group-hover:text-indigo-400 transition-colors">{item.ticker}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.company}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>Offer Date: {formatDate(item.exDate)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-indigo-300 block">{item.price}</span>
                      <span className="text-[9px] text-indigo-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
                        View <ArrowRight className="h-2 w-2" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Splits */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Scissors className="h-4 w-4" />
              <span>Upcoming Stock Splits</span>
            </div>
            
            <div className="space-y-2">
              {data.upcomingSplits.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No scheduled stock splits found.</p>
              ) : (
                data.upcomingSplits.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => onSelectTicker(item.ticker)}
                    className="p-3.5 rounded-xl border border-white/5 bg-slate-950/20 hover:bg-slate-900/60 hover:border-indigo-500/30 transition-all cursor-pointer group flex justify-between items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-200 group-hover:text-indigo-400 transition-colors">{item.ticker}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.company}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>Ex-Date: {formatDate(item.exDate)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-amber-400 block">{item.ratio}</span>
                      <span className="text-[9px] text-indigo-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-0.5">
                        View <ArrowRight className="h-2 w-2" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* IPO LISTINGS */}
      {activeSubTab === "ipos" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Mainboard IPOs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Building2 className="h-4 w-4" />
              <span>Mainboard IPOs</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-950/40 text-slate-400 font-semibold">
                      <th className="p-3">Company Name</th>
                      <th className="p-3">Price Band</th>
                      <th className="p-3">Open / Close</th>
                      <th className="p-3 text-right">Issue Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.upcomingMainboardIPOs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No upcoming mainboard IPOs found.</td>
                      </tr>
                    ) : (
                      data.upcomingMainboardIPOs.map((ipo, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-bold text-slate-200">{ipo.company}</td>
                          <td className="p-3 font-semibold text-emerald-400">{ipo.priceBand}</td>
                          <td className="p-3 text-slate-400">
                            {formatDate(ipo.openDate)} - {formatDate(ipo.closeDate)}
                          </td>
                          <td className="p-3 text-right font-extrabold text-indigo-300">{ipo.size}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SME IPOs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Rocket className="h-4 w-4" />
              <span>SME IPOs Center</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-950/40 text-slate-400 font-semibold">
                      <th className="p-3">Company Name</th>
                      <th className="p-3">Price Band</th>
                      <th className="p-3">Open / Close</th>
                      <th className="p-3 text-right">Issue Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.upcomingSmeIPOs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">No upcoming SME IPOs found.</td>
                      </tr>
                    ) : (
                      data.upcomingSmeIPOs.map((ipo, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-bold text-slate-200">{ipo.company}</td>
                          <td className="p-3 font-semibold text-emerald-400">{ipo.priceBand}</td>
                          <td className="p-3 text-slate-400">
                            {formatDate(ipo.openDate)} - {formatDate(ipo.closeDate)}
                          </td>
                          <td className="p-3 text-right font-extrabold text-indigo-300">{ipo.size}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
