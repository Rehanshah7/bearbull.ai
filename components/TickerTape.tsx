"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface TickerQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  shortName?: string;
}

interface TickerTapeProps {
  quotes: TickerQuote[];
  loading: boolean;
  onSelectTicker: (symbol: string) => void;
}

export default function TickerTape({ quotes, loading, onSelectTicker }: TickerTapeProps) {
  // Duplicate items for seamless continuous looping marquee effect
  const doubleQuotes = useMemo(() => {
    if (quotes.length === 0) return [];
    return [...quotes, ...quotes, ...quotes];
  }, [quotes]);

  if (loading && quotes.length === 0) {
    return (
      <div className="w-full bg-slate-900/60 border-y border-white/5 py-2.5 overflow-hidden backdrop-blur-md">
        <div className="flex justify-center items-center text-xs text-slate-400 gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          Streaming Live Indian Market Indices...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900/80 border-y border-white/5 py-3 overflow-hidden backdrop-blur-md relative group select-none">
      {/* Decorative side fades */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      {/* Scrolling container */}
      <div className="flex overflow-hidden">
        <div 
          className="flex whitespace-nowrap gap-8 animate-marquee group-hover:pause"
          style={{
            animation: "marquee 45s linear infinite",
          }}
        >
          {doubleQuotes.map((item, index) => {
            const isUp = item.regularMarketChangePercent >= 0;
            return (
              <button
                key={index}
                onClick={() => onSelectTicker(item.symbol)}
                className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors text-left outline-none cursor-pointer"
              >
                <span className="text-xs font-black tracking-wide text-slate-200 uppercase">
                  {item.shortName}
                </span>
                <span className="text-xs font-extrabold text-slate-300">
                  ₹{item.regularMarketPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {isUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {isUp ? "+" : ""}{item.regularMarketChangePercent?.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-33.3333%, 0, 0);
          }
        }
        .pause {
          animation-play-state: paused !important;
        }
      `}</style>
    </div>
  );
}
