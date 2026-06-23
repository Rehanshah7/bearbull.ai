"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface StockSearchProps {
  onSearch: (symbol: string) => void;
}

export default function StockSearch({ onSearch }: StockSearchProps) {
  const [ticker, setTicker] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced search for ticker suggestions
  useEffect(() => {
    if (!ticker.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(ticker)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setSuggestions(json.data);
        }
      } catch (err) {
        console.error("Failed to load suggestions:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [ticker]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      onSearch(ticker.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Search Input & Suggestions dropdown */}
      <form onSubmit={handleSearch} className="flex gap-3 relative">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
            <Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search the exact company name (e.g. BSE, Reliance, TCS) and select from the list"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 focus:bg-slate-900/80 transition-all duration-300"
          />

          {/* Dismiss overlay */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowSuggestions(false)} 
            />
          )}

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
              {suggestions.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onSearch(item.symbol);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-800/80 transition-colors flex justify-between items-center border-b border-slate-800 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 text-sm">{item.symbol}</span>
                    <span className="text-slate-400 text-xs truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                  </div>
                  <div className="flex flex-col items-end text-[10px]">
                    <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">{item.typeDisp}</span>
                    <span className="text-slate-500 mt-1">{item.exchDisp}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors duration-300 active:scale-[0.98] z-10"
        >
          Search
        </button>
      </form>
    </div>
  );
}
