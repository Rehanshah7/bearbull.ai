"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  LayoutDashboard,
  Star,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Search
} from "lucide-react";
import StockSearch from "./StockSearch";
import StockDetailsView from "./StockDetailsView";
import CorporateHubView from "./CorporateHubView";
import TickerTape, { TickerQuote } from "./TickerTape";
import { isIndianMarketOpen } from "@/utils/market";

interface DashboardClientProps {
  user: any;
}

interface WatchlistQuote {
  price: number;
  change: number;
  shortName: string;
}

const INDIAN_TICKERS = [
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
  "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "LICI.NS", "HINDUNILVR.NS",
  "LT.NS", "ADANIENT.NS", "BSE.NS", "TATAMOTORS.NS", "ONGC.NS",
  "KOTAKBANK.NS", "AXISBANK.NS", "NTPC.NS", "SUNPHARMA.NS", "M&M.NS",
  "MARUTI.NS", "ULTRACEMCO.NS", "POWERGRID.NS", "JSWSTEEL.NS", "TATASTEEL.NS",
  "HCLTECH.NS", "WIPRO.NS", "ADANIPORTS.NS", "COALINDIA.NS", "ASIANPAINT.NS"
];

const INDEX_TICKERS = [
  "^NSEI",     // NIFTY 50
  "^BSESN",    // SENSEX
  "^NSEBANK",  // NIFTY BANK
  "^INDIAVIX"  // INDIA VIX
];

export default function DashboardClient({ user }: DashboardClientProps) {
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"search" | "watchlist" | "movers">("search");

  const selectTicker = (symbol: string | null) => {
    setActiveTicker(symbol);
    if (symbol) {
      setMobileTab("search");
    }
  };

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<any[]>([]);
  const [watchlistSort, setWatchlistSort] = useState<"desc" | "asc">("desc");
  const [showWelcome, setShowWelcome] = useState(true);

  // States for shared Indian Market Ticker Quotes
  const [marketQuotes, setMarketQuotes] = useState<TickerQuote[]>([]);
  const [marketQuotesLoading, setMarketQuotesLoading] = useState(true);

  // States for Indian Indices (Nifty 50, Sensex, etc.)
  const [indicesQuotes, setIndicesQuotes] = useState<any[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(true);

  // Tab control for gainers/losers widget
  const [moversTab, setMoversTab] = useState<"profit" | "loss">("profit");

  const name = user?.user_metadata?.full_name || user?.email;

  // 1. Fetch Market Tickers Quotes (lifts state for Ticker Tape & Top Movers)
  const fetchMarketQuotes = async () => {
    try {
      const res = await fetch(`/api/stock/batch?symbols=${INDIAN_TICKERS.join(",")}`);
      const json = await res.json();
      if (json.success && json.data) {
        const mapped: TickerQuote[] = json.data.map((q: any) => ({
          symbol: q.symbol,
          regularMarketPrice: q.regularMarketPrice,
          regularMarketChangePercent: q.regularMarketChangePercent,
          shortName: q.shortName || q.symbol.split(".")[0]
        }));
        setMarketQuotes(mapped);
      }
    } catch (err) {
      console.error("Failed to load market quotes:", err);
    } finally {
      setMarketQuotesLoading(false);
    }
  };

  // 2. Fetch Major Indices
  const fetchIndicesQuotes = async () => {
    try {
      const res = await fetch(`/api/stock/batch?symbols=${INDEX_TICKERS.join(",")}`);
      const json = await res.json();
      if (json.success && json.data) {
        setIndicesQuotes(json.data);
      }
    } catch (err) {
      console.error("Failed to load indices quotes:", err);
    } finally {
      setIndicesLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketQuotes();
    fetchIndicesQuotes();
    const interval = setInterval(() => {
      // ONLY refresh quotes during Indian stock market hours
      if (isIndianMarketOpen()) {
        fetchMarketQuotes();
        fetchIndicesQuotes();
      }
    }, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  // 3. Initial Load of Watchlist from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("bearbull_watchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse watchlist", err);
      }
    } else {
      // Default initial watchlist items for a premium look
      const defaults = ["BSE.NS", "RELIANCE.NS", "TCS.NS"];
      setWatchlist(defaults);
      localStorage.setItem("bearbull_watchlist", JSON.stringify(defaults));
    }
  }, []);

  // 4. Fetch Watchlist Quotes in batch (backend sorted by default)
  const fetchWatchlistQuotes = async (symbolsList: string[], sortDir: "desc" | "asc" = "desc") => {
    if (symbolsList.length === 0) {
      setWatchlistQuotes([]);
      return;
    }
    try {
      const res = await fetch(`/api/stock/batch?symbols=${symbolsList.join(",")}&sort=${sortDir}`);
      const json = await res.json();
      if (json.success && json.data) {
        setWatchlistQuotes(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch watchlist quotes", err);
    }
  };

  // Trigger watchlist updates when watchlist array updates
  useEffect(() => {
    fetchWatchlistQuotes(watchlist, watchlistSort);
  }, [watchlist, watchlistSort]);

  // 5. Watchlist background sync every 10 seconds (respects market hours)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isIndianMarketOpen()) {
        fetchWatchlistQuotes(watchlist, watchlistSort);
      }
    }, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [watchlist, watchlistSort]);

  // 6. Toggle Watchlist (Add / Remove)
  const toggleWatchlist = (symbol: string) => {
    let updated: string[];
    if (watchlist.includes(symbol)) {
      updated = watchlist.filter((s) => s !== symbol);
    } else {
      updated = [...watchlist, symbol];
    }
    setWatchlist(updated);
    localStorage.setItem("bearbull_watchlist", JSON.stringify(updated));
  };

  // Remove from watchlist helper
  const removeFromWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation(); // Avoid selecting stock ticker on removal click
    const updated = watchlist.filter((s) => s !== symbol);
    setWatchlist(updated);
    localStorage.setItem("bearbull_watchlist", JSON.stringify(updated));
  };

  // 7. Calculate Top Profit (Gainers) and Loss (Losers) Stocks
  const profitStocks = useMemo(() => {
    return [...marketQuotes]
      .sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
      .slice(0, 10);
  }, [marketQuotes]);

  const lossStocks = useMemo(() => {
    return [...marketQuotes]
      .sort((a, b) => a.regularMarketChangePercent - b.regularMarketChangePercent)
      .slice(0, 10);
  }, [marketQuotes]);

  const renderWatchlistArea = () => (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">My Watchlist</h4>
        </div>

        <button
          onClick={() => setWatchlistSort(prev => prev === "desc" ? "asc" : "desc")}
          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/5 cursor-pointer transition-all duration-300"
          title="Toggle Watchlist Sorting (High-to-Low vs Low-to-High)"
        >
          {watchlistSort === "desc" ? "High → Low" : "Low → High"}
        </button>
      </div>

      <div className="space-y-2 max-h-[350px] lg:max-h-[220px] overflow-y-auto pr-1">
        {watchlistQuotes.map((quote) => {
          const symbol = quote.symbol;
          const isUp = quote.regularMarketChangePercent >= 0;

          return (
            <div
              key={symbol}
              onClick={() => selectTicker(symbol)}
              className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer group ${activeTicker === symbol
                ? "bg-indigo-900/30 border-indigo-500/40"
                : "bg-slate-950/40 border-white/5 hover:border-slate-800 hover:bg-slate-900/50"
                }`}
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="font-bold text-slate-200 text-xs truncate uppercase">
                  {quote.shortName || symbol.split(".")[0]}
                </span>
                <span className="text-[9px] text-slate-500 truncate uppercase mt-0.5">
                  {symbol}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <span className="block font-extrabold text-slate-200 text-xs">
                    ₹{quote.regularMarketPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`inline-flex items-center text-[9px] font-bold mt-0.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                    {isUp ? "+" : ""}{quote.regularMarketChangePercent?.toFixed(2)}%
                  </span>
                </div>

                <button
                  onClick={(e) => removeFromWatchlist(e, symbol)}
                  className="p-1 rounded-lg bg-transparent hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 outline-none cursor-pointer"
                  title="Remove from Watchlist"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {watchlist.length > 0 && watchlistQuotes.length === 0 && (
          <div className="text-center py-6 text-[11px] text-slate-500">
            Loading watchlist...
          </div>
        )}

        {watchlist.length === 0 && (
          <div className="text-center py-6 text-[11px] text-slate-500">
            Your watchlist is empty. Save stocks from their detailed charts.
          </div>
        )}
      </div>
    </div>
  );

  const renderMoversArea = () => (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Flame className="h-4 w-4 text-indigo-400" />
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Today's Movers</h4>
      </div>

      {/* Movers Tab Header */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
        <button
          onClick={() => setMoversTab("profit")}
          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer outline-none ${moversTab === "profit"
            ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> Profit Stocks
        </button>
        <button
          onClick={() => setMoversTab("loss")}
          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer outline-none ${moversTab === "loss"
            ? "bg-rose-600/10 text-rose-400 border border-rose-500/20"
            : "text-slate-400 hover:text-slate-200"
            }`}
        >
          <ArrowDownRight className="h-3.5 w-3.5" /> Loss Stocks
        </button>
      </div>

      {/* Movers List View */}
      <div className="space-y-2 max-h-[400px] lg:max-h-[350px] overflow-y-auto pr-1">
        {(moversTab === "profit" ? profitStocks : lossStocks).map((item) => {
          const isUp = item.regularMarketChangePercent >= 0;
          return (
            <div
              key={item.symbol}
              onClick={() => selectTicker(item.symbol)}
              className="flex justify-between items-center p-2.5 rounded-xl border border-white/5 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-900/40 transition-all cursor-pointer"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-200 text-xs truncate uppercase">
                  {item.shortName}
                </span>
                <span className="text-[8px] text-slate-500 truncate uppercase mt-0.5">
                  {item.symbol}
                </span>
              </div>

              <div className="text-right shrink-0">
                <span className="block font-extrabold text-slate-200 text-xs">
                  ₹{item.regularMarketPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`inline-flex items-center text-[9px] font-bold mt-0.5 px-1 py-0.2 bg-white/5 rounded ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {isUp ? "+" : ""}{item.regularMarketChangePercent?.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}

        {marketQuotes.length === 0 && (
          <div className="text-center py-6 text-[11px] text-slate-500">
            Loading today's movers...
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative pb-20 lg:pb-0">
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-100px)] gap-6">

        {/* DESKTOP SIDEBAR: Navigation, Saved Watchlist & Movers */}
        <aside className="hidden lg:block lg:w-80 shrink-0 space-y-6">
          {/* Navigation Sidebar Area */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation</h4>
            <button
              onClick={() => selectTicker(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm outline-none cursor-pointer ${!activeTicker
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard Home
            </button>
          </div>

          {renderWatchlistArea()}
          {renderMoversArea()}
        </aside>

        {/* MOBILE ONLY WATCHLIST VIEW */}
        {mobileTab === "watchlist" && (
          <div className="flex-1 space-y-6 min-w-0 lg:hidden">
            {renderWatchlistArea()}
          </div>
        )}

        {/* MOBILE ONLY MOVERS VIEW */}
        {mobileTab === "movers" && (
          <div className="flex-1 space-y-6 min-w-0 lg:hidden">
            {renderMoversArea()}
          </div>
        )}

        {/* RIGHT MAIN PANEL (Explore/Search & Details) */}
        <div className={`flex-1 space-y-6 min-w-0 ${mobileTab === "search" ? "block" : "hidden lg:block"}`}>
          {/* Continuous Indian Ticker Tape Banner */}
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <TickerTape
              quotes={marketQuotes}
              loading={marketQuotesLoading}
              onSelectTicker={selectTicker}
            />
          </div>

          {/* Major Indian Market Indices cards row */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Market Indices</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {indicesQuotes.map((indexQuote) => {
                const isUp = (indexQuote.regularMarketChangePercent || 0) >= 0;
                const nameMap: Record<string, string> = {
                  "^NSEI": "NIFTY 50",
                  "^BSESN": "SENSEX",
                  "^NSEBANK": "NIFTY BANK",
                  "^INDIAVIX": "INDIA VIX"
                };
                const displayName = nameMap[indexQuote.symbol] || indexQuote.shortName || indexQuote.symbol;

                return (
                  <div
                    key={indexQuote.symbol}
                    onClick={() => selectTicker(indexQuote.symbol)}
                    className="rounded-2xl border border-white/10 bg-slate-900/40 p-4.5 backdrop-blur-md hover:border-slate-700 hover:bg-slate-900/60 transition-all cursor-pointer select-none relative overflow-hidden group shadow-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{indexQuote.symbol}</span>
                        <span className="block text-sm font-extrabold text-slate-100 mt-0.5 group-hover:text-indigo-400 transition-colors truncate">{displayName}</span>
                      </div>
                      <span className={`inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded shrink-0 ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                        {isUp ? "+" : ""}{indexQuote.regularMarketChangePercent?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-1.5 border-t border-white/5 pt-2.5">
                      <span className="text-lg md:text-xl font-black text-white tracking-tight">
                        {indexQuote.regularMarketPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`text-xs font-bold ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                        {isUp ? "▲" : "▼"} {Math.abs(indexQuote.regularMarketChange || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {indicesQuotes.length === 0 && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 animate-pulse h-20">
                      <div className="h-3 w-1/2 bg-white/10 rounded"></div>
                      <div className="h-4 w-3/4 bg-white/10 rounded mt-3"></div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Welcome & Info Card */}
          {showWelcome && (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl relative">
              <button
                onClick={() => setShowWelcome(false)}
                className="absolute cursor-pointer top-6 right-6 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-all duration-300"
                title="Close Welcome Popup"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                Welcome back, {name || "Trader"}!
              </h2>
              <p className="text-slate-400 text-sm max-w-xl">
                <span>
                  Currently viewing in-depth analysis for <strong className="text-indigo-400 font-extrabold">{activeTicker ? activeTicker : "Stock Market"}</strong>.
                </span>
              </p>
            </div>
          )}

          {/* Stock Search Module */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-200">Stock Market Search</h3>
            <StockSearch onSearch={selectTicker} />
          </div>

          {/* Corporate Hub View (upcoming IPOs, dividends, splits, buybacks) */}
          {!activeTicker && (
            <div className="mt-6">
              <CorporateHubView onSelectTicker={selectTicker} />
            </div>
          )}

          {/* Stock Details Analytics Block (rendered inline on search) */}
          {activeTicker && (
            <div className="rounded-3xl border border-white/10 bg-slate-900/20 p-6 backdrop-blur-xl shadow-2xl space-y-6">
              <StockDetailsView
                ticker={activeTicker}
                onClose={() => selectTicker(null)}
                isWatchlisted={watchlist.includes(activeTicker)}
                onToggleWatchlist={() => toggleWatchlist(activeTicker)}
              />
            </div>
          )}
        </div>

      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 border-t border-white/10 backdrop-blur-lg lg:hidden px-6 py-2.5 flex justify-around items-center">
        <button
          onClick={() => setMobileTab("search")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${mobileTab === "search" ? "text-indigo-400 font-bold scale-105" : "text-slate-400"}`}
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px]">Explore</span>
        </button>
        <button
          onClick={() => setMobileTab("watchlist")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${mobileTab === "watchlist" ? "text-indigo-400 font-bold scale-105" : "text-slate-400"}`}
        >
          <Star className="h-5 w-5" />
          <span className="text-[10px]">Watchlist</span>
        </button>
        <button
          onClick={() => setMobileTab("movers")}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${mobileTab === "movers" ? "text-indigo-400 font-bold scale-105" : "text-slate-400"}`}
        >
          <Flame className="h-5 w-5" />
          <span className="text-[10px]">Movers</span>
        </button>
      </div>
    </div>
  );
}
