"use client";

import { use, useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  Newspaper,
  Activity,
  Info,
  Compass,
  TrendingUp as TrendIcon,
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import type { StockApiResponse } from "@/app/api/types/api.types";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default function StockDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const ticker = resolvedParams.ticker.toUpperCase();

  // Component States
  const [data, setData] = useState<StockApiResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX">("1Y");
  const [hoveredData, setHoveredData] = useState<{ date: string; price: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chart hover calculation ref
  const chartRef = useRef<SVGSVGElement | null>(null);

  // 1. Initial Data Fetch
  useEffect(() => {
    async function initFetch() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        const json: StockApiResponse = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to fetch stock details");
        }
      } catch (err) {
        setError("Network error occurred while fetching stock details.");
      } finally {
        setLoading(false);
      }
    }
    initFetch();
  }, [ticker]);

  // 2. Auto-Refresh quote data every 10 seconds (background updates)
  useEffect(() => {
    if (loading || error || !data) return;

    const interval = setInterval(async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        const json: StockApiResponse = await res.json();
        if (json.success && json.data) {
          setData(prev => {
            if (!prev) return json.data!;
            return {
              ...prev,
              quote: json.data!.quote, // Update latest live quote
              news: json.data!.news || prev.news // Retain/update news
            };
          });
        }
      } catch (err) {
        console.error("Live price auto-refresh failed", err);
      } finally {
        setIsRefreshing(false);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [loading, error, data, ticker]);

  const quote = data?.quote;
  const historical = data?.historical || [];
  const news = data?.news || [];

  // Dynamic Currency Conversion Helper (USD -> INR conversion if source is in USD)
  const conversionRate = useMemo(() => {
    if (!quote) return 1;
    if (quote.currency === "USD") return 83.5; // conversion multiplier
    return 1;
  }, [quote]);

  // Helper to format values as Rupees (₹)
  const formatRupee = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "₹N/A";
    return "₹" + (val * conversionRate).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper to format values as Rupees (₹) directly (when already in Rupees, e.g. from AI)
  const formatINR = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "₹N/A";
    return "₹" + val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper to format market capitalization beautifully in Crores or Lakhs of Rupees
  const formatMarketCap = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "₹N/A";
    const valInINR = val * conversionRate;
    if (valInINR >= 1e7) {
      return `₹${(valInINR / 1e7).toFixed(2)} Cr`;
    }
    if (valInINR >= 1e5) {
      return `₹${(valInINR / 1e5).toFixed(2)} L`;
    }
    return `₹${valInINR.toLocaleString()}`;
  };

  // 3. Timeframe Filtering & SVG Chart Path Builder
  const filteredHistorical = useMemo(() => {
    const now = new Date();

    if (timeframe === "1D") {
      const intraday = data?.intraday || [];
      if (!intraday.length) return [];
      const lastDateStr = intraday[intraday.length - 1].date;
      const lastDateString = new Date(lastDateStr).toDateString();
      return intraday.filter(d => new Date(d.date).toDateString() === lastDateString);
    }

    if (timeframe === "1W") {
      const intraday = data?.intraday || [];
      if (intraday.length) return intraday;
      
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 7);
      return historical.filter(d => new Date(d.date) >= cutoff);
    }

    if (!historical.length) return [];
    const cutoff = new Date();

    if (timeframe === "1M") cutoff.setMonth(now.getMonth() - 1);
    else if (timeframe === "3M") cutoff.setMonth(now.getMonth() - 3);
    else if (timeframe === "6M") cutoff.setMonth(now.getMonth() - 6);
    else if (timeframe === "1Y") cutoff.setFullYear(now.getFullYear() - 1);
    else if (timeframe === "5Y") cutoff.setFullYear(now.getFullYear() - 5);
    else if (timeframe === "MAX") return historical;

    return historical.filter(d => new Date(d.date) >= cutoff);
  }, [historical, data?.intraday, timeframe]);

  // Map filtered points to coordinates
  const chartPathData = useMemo(() => {
    if (filteredHistorical.length < 2) return { linePath: "", areaPath: "", points: [] };

    const width = 800;
    const height = 300;
    const padding = 20;

    const closePrices = filteredHistorical.map(d => d.close);
    const maxVal = Math.max(...closePrices) * 1.02;
    const minVal = Math.min(...closePrices) * 0.98;
    const priceRange = maxVal - minVal || 1;

    const minTime = new Date(filteredHistorical[0].date).getTime();
    const maxTime = new Date(filteredHistorical[filteredHistorical.length - 1].date).getTime();
    const timeRange = maxTime - minTime || 1;

    const points = filteredHistorical.map((d) => {
      const x = padding + ((new Date(d.date).getTime() - minTime) / timeRange) * (width - padding * 2);
      const y = height - padding - ((d.close - minVal) / priceRange) * (height - padding * 2);
      return {
        x,
        y,
        price: d.close,
        date: ["1D", "1W"].includes(timeframe)
          ? new Date(d.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
      };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    // Create closed path for gradient fill
    const areaPath = [
      ...points,
      { x: points[points.length - 1].x, y: height - padding },
      { x: points[0].x, y: height - padding }
    ].map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

    return { linePath, areaPath, points };
  }, [filteredHistorical]);

  // Handle SVG Mouse Interactivity
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartPathData.points.length || !chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find the point closest to mouseX
    let closest = chartPathData.points[0];
    let minDist = Math.abs(chartPathData.points[0].x - mouseX);

    for (let i = 1; i < chartPathData.points.length; i++) {
      const dist = Math.abs(chartPathData.points[i].x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = chartPathData.points[i];
      }
    }

    setHoveredData({ date: closest.date, price: closest.price });
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  // Determine if stock is up or down over selected period
  const isPeriodUp = useMemo(() => {
    if (filteredHistorical.length < 2) return true;
    const startPrice = filteredHistorical[0].close;
    const endPrice = filteredHistorical[filteredHistorical.length - 1].close;
    return endPrice >= startPrice;
  }, [filteredHistorical]);

  // 4. Advanced Technical Indicators (RSI, SMAs)
  const technicals = useMemo(() => {
    if (historical.length < 50) {
      return { rsi: 50, sma50: 0, sma200: 0, goldenCross: false, priceVsSma50: "Neutral", recommendation: "HOLD", score: 50 };
    }

    const closePrices = historical.map(d => d.close);
    const currentPrice = quote?.regularMarketPrice || closePrices[closePrices.length - 1];

    // Simple Moving Averages
    const sma50 = closePrices.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const sma200 = historical.length >= 200
      ? closePrices.slice(-200).reduce((a, b) => a + b, 0) / 200
      : closePrices.reduce((a, b) => a + b, 0) / historical.length;

    // 14-day RSI calculation
    const rsiPeriod = 14;
    const rsiData = closePrices.slice(-100); // last 100 days
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = rsiData[i] - rsiData[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / rsiPeriod;
    let avgLoss = losses / rsiPeriod;

    for (let i = rsiPeriod + 1; i < rsiData.length; i++) {
      const diff = rsiData[i] - rsiData[i - 1];
      avgGain = (avgGain * (rsiPeriod - 1) + (diff > 0 ? diff : 0)) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + (diff < 0 ? -diff : 0)) / rsiPeriod;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

    // Signals check
    const goldenCross = sma50 > sma200;
    const priceVsSma50 = currentPrice > sma50 ? "Bullish" : "Bearish";

    let bullCount = 0;
    let bearCount = 0;

    if (goldenCross) bullCount++; else bearCount++;
    if (priceVsSma50 === "Bullish") bullCount++; else bearCount++;
    if (rsi < 30) bullCount += 2; // Oversold turning point
    else if (rsi > 70) bearCount += 2; // Overbought turning point

    let recommendation: "BUY" | "SELL" | "HOLD" = "HOLD";
    let score = 50;

    if (bullCount > bearCount) {
      recommendation = "BUY";
      score = 75 + Math.min(25, bullCount * 10);
    } else if (bearCount > bullCount) {
      recommendation = "SELL";
      score = 25 - Math.min(25, bearCount * 10);
    }

    return { rsi, sma50, sma200, goldenCross, priceVsSma50, recommendation, score };
  }, [historical, quote]);

  // 5. 5-Year Performance calculation
  const fiveYearPerformance = useMemo(() => {
    if (historical.length < 2) return 0;
    const startPrice = historical[0].close;
    const endPrice = historical[historical.length - 1].close;
    return ((endPrice - startPrice) / startPrice) * 100;
  }, [historical]);

  // 6. Quantitative Price Predictions Model
  const predictions = useMemo(() => {
    if (historical.length < 20 || !quote) {
      return {
        cagr: 0,
        volatility: 0,
        targets: {
          "1M": { low: 0, med: 0, high: 0 },
          "6M": { low: 0, med: 0, high: 0 },
          "1Y": { low: 0, med: 0, high: 0 },
        },
        insights: "Insufficient historical data to construct a valid forecasting simulation."
      };
    }

    const prices = historical.map(d => d.close);
    const latestPrice = quote.regularMarketPrice || prices[prices.length - 1];

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Mean and standard deviation of daily returns
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const dailyVol = Math.sqrt(variance);

    // Annualized figures
    const totalDays = (new Date(historical[historical.length - 1].date).getTime() - new Date(historical[0].date).getTime()) / (1000 * 60 * 60 * 24);
    const years = totalDays / 365.25 || 1;

    // CAGR calculation
    const cagr = Math.pow(prices[prices.length - 1] / prices[0], 1 / years) - 1;
    const volatility = dailyVol * Math.sqrt(252);

    // Dynamic statistical predictions (using log-normal distribution equations)
    const project = (days: number) => {
      const t = days / 365.25;
      const expectedFactor = Math.exp((cagr - 0.5 * volatility * volatility) * t);
      const median = latestPrice * expectedFactor;

      const logStdDev = volatility * Math.sqrt(t);
      // 90% confidence boundaries (Z = 1.645)
      const low = latestPrice * Math.exp(Math.log(expectedFactor) - 1.645 * logStdDev);
      const high = latestPrice * Math.exp(Math.log(expectedFactor) + 1.645 * logStdDev);

      return { low, med: median, high };
    };

    const targets = {
      "1M": project(30),
      "6M": project(182),
      "1Y": project(365),
    };

    // Construct highly descriptive and custom text insights
    let riskClassification = "Moderate Market Risk";
    if (volatility > 0.35) riskClassification = "High-Vol / Speculative Risk Profile";
    else if (volatility < 0.15) riskClassification = "Low Volatility / Conservative Profile";

    let trendDescription = "experiencing consolidation";
    if (cagr > 0.20) trendDescription = "exhibiting stellar double-digit CAGR growth";
    else if (cagr > 0.05) trendDescription = "showing solid linear gains";
    else if (cagr < -0.05) trendDescription = "experiencing downward pressure and structural headwinds";

    const insights = `Our quantitative model evaluated the trading patterns of ${quote.symbol} over the last ${years.toFixed(1)} years. The stock operates with an annualized volatility of ${(volatility * 100).toFixed(1)}% (${riskClassification}) and a compound annual growth rate (CAGR) of ${(cagr * 100).toFixed(1)}%, indicating it is ${trendDescription}. 

Based on BearBull predictive simulations, we project the stock's 1-year median price target to be ${formatRupee(targets["1Y"].med)} (in Rupees). Under optimal market conditions (95th percentile), the price could reach up to ${formatRupee(targets["1Y"].high)}. Conversely, during a bearish downturn, the statistical support floor is situated around ${formatRupee(targets["1Y"].low)}.`;

    return {
      cagr: cagr * 100,
      volatility: volatility * 100,
      targets,
      insights
    };
  }, [historical, quote, conversionRate]);

  // UI Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-medium">Fetching real-time stock analytics in Rupees...</p>
        </div>
      </div>
    );
  }

  // UI Error State
  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="max-w-md p-8 rounded-2xl border border-red-500/25 bg-red-500/5 text-center space-y-6">
          <Info className="h-12 w-12 text-red-400 mx-auto" />
          <h3 className="text-xl font-bold text-slate-200">Lookup Failure</h3>
          <p className="text-sm text-slate-400">{error || "Unable to retrieve stock data. Symbol may be incorrect or delisted."}</p>
          <Link href="/dashboard" className="inline-block px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Recommendation specific designs
  const recommendationValue = data?.aiInsights?.recommendation || technicals.recommendation;
  const confidenceValue = data?.aiInsights?.confidence ?? technicals.score;
  const recBadgeColor =
    recommendationValue.includes("BUY")
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : recommendationValue.includes("SELL")
        ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
        : "text-amber-400 bg-amber-500/10 border-amber-500/30";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-indigo-500 rounded-full filter blur-[150px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[500px] h-[400px] bg-emerald-500 rounded-full filter blur-[180px] opacity-5 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-8">

        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        {/* Stock Headline Info */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                {quote.symbol}
              </span>
              <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                {quote.fullExchangeName} • Converted to Indian Rupee (INR)
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight mt-3">
              {quote.longName || quote.shortName || quote.symbol}
            </h1>
          </div>

          <div className="text-left md:text-right space-y-1">
            <div className="flex items-baseline gap-3 md:justify-end">
              <span className="text-4xl md:text-6xl font-black text-slate-100">
                {formatRupee(quote.regularMarketPrice)}
              </span>
              <span className={`flex items-center gap-0.5 text-base md:text-lg font-bold px-2 py-0.5 rounded-lg ${quote.regularMarketChangePercent !== undefined && quote.regularMarketChangePercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {quote.regularMarketChangePercent !== undefined && quote.regularMarketChangePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatRupee(quote.regularMarketChange)} ({quote.regularMarketChangePercent?.toFixed(2)}%)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live price converted at standard rate (1 USD = 83.50 INR)
            </p>
          </div>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Chart, Predictions & News */}
          <div className="lg:col-span-2 space-y-8">

            {/* SVG Interactive Chart Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-100">Price Chart (INR)</h3>
                  <p className="text-xs text-slate-400">Hover cursor to inspect historical valuations in Rupees</p>
                </div>

                {/* Timeframe selector */}
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(["1M", "6M", "1Y", "5Y"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeframe === t ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Legend details */}
              <div className="h-6 flex justify-between text-xs text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-white/5">
                {hoveredData ? (
                  <>
                    <span>Hovered Date: <strong className="text-indigo-400">{hoveredData.date}</strong></span>
                    <span>Close Price: <strong className="text-indigo-400">{formatRupee(hoveredData.price)}</strong></span>
                  </>
                ) : (
                  <>
                    <span>Timeframe Trend: <strong className={isPeriodUp ? "text-emerald-400" : "text-rose-400"}>{isPeriodUp ? "Upward" : "Downward"} Trajectory</strong></span>
                    <span>Initial Close: <strong>{formatRupee(filteredHistorical[0]?.close)}</strong></span>
                  </>
                )}
              </div>

              {/* SVG Chart Render */}
              <div className="relative">
                <svg
                  ref={chartRef}
                  viewBox="0 0 800 300"
                  className="w-full h-auto cursor-crosshair overflow-visible"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPeriodUp ? "#10b981" : "#f43f5e"} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={isPeriodUp ? "#10b981" : "#f43f5e"} stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guideline grids */}
                  <line x1="20" y1="50" x2="780" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="20" y1="150" x2="780" y2="150" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                  <line x1="20" y1="250" x2="780" y2="250" stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />

                  {/* Area fill */}
                  {chartPathData.areaPath && (
                    <path d={chartPathData.areaPath} fill="url(#chartGradient)" />
                  )}

                  {/* Chart line */}
                  {chartPathData.linePath && (
                    <path
                      d={chartPathData.linePath}
                      fill="none"
                      stroke={isPeriodUp ? "#10b981" : "#f43f5e"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Active Hover guide-line */}
                  {hoveredData && chartPathData.points.length > 0 && (() => {
                    const activePoint = chartPathData.points.find(p => p.date === hoveredData.date);
                    if (!activePoint) return null;
                    return (
                      <>
                        <line
                          x1={activePoint.x}
                          y1="20"
                          x2={activePoint.x}
                          y2="280"
                          stroke="#6366f1"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                        />
                        <circle
                          cx={activePoint.x}
                          cy={activePoint.y}
                          r="6"
                          fill="#6366f1"
                          stroke="#1e1b4b"
                          strokeWidth="2"
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* FUTURE PRICE PREDICTIONS & STATISTICAL INSIGHTS */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-indigo-400" />
                <h3 className="text-lg font-extrabold text-slate-100">Future Price Predictions (INR)</h3>
              </div>

              {/* Table of Forecast Targets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.aiInsights ? (
                  <>
                    {[
                      { label: "3-Month Forecast", key: "threeMonth" },
                      { label: "6-Month Forecast", key: "sixMonth" },
                      { label: "1-Year Forecast", key: "oneYear" }
                    ].map((item) => {
                      const target = data.aiInsights!.targets[item.key as "threeMonth" | "sixMonth" | "oneYear"];
                      return (
                        <div key={item.key} className="p-4 rounded-xl border border-white/5 bg-slate-950/40 space-y-3">
                          <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-slate-400">{item.label}</span>
                            <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-500/10 rounded">Gemini AI</span>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-rose-400">
                              <span>Low Target (Bearish)</span>
                              <span className="font-semibold">{formatINR(target.low)}</span>
                            </div>
                            <div className="flex justify-between text-indigo-200 font-bold border-y border-white/5 py-1">
                              <span>Median Target</span>
                              <span>{formatINR(target.med)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>High Target (Bullish)</span>
                              <span className="font-semibold">{formatINR(target.high)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  (["1M", "6M", "1Y"] as const).map((period) => {
                    const target = predictions.targets[period];
                    return (
                      <div key={period} className="p-4 rounded-xl border border-white/5 bg-slate-950/40 space-y-3">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-xs font-bold text-slate-400">{period === "1M" ? "1-Month Forecast" : period === "6M" ? "6-Month Forecast" : "1-Year Forecast"}</span>
                          <span className="text-[10px] text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-500/10 rounded">Projections</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-rose-400">
                            <span>Low Target (Bearish)</span>
                            <span className="font-semibold">{formatRupee(target.low)}</span>
                          </div>
                          <div className="flex justify-between text-indigo-200 font-bold border-y border-white/5 py-1">
                            <span>Median Target</span>
                            <span>{formatRupee(target.med)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400">
                            <span>High Target (Bullish)</span>
                            <span className="font-semibold">{formatRupee(target.high)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Descriptive Analytics text */}
              <div className="p-4 rounded-xl border border-indigo-500/25 bg-indigo-500/5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-[10px] text-indigo-400 font-extrabold tracking-widest uppercase">
                  BearBull AI
                </div>
                <h4 className="text-xs font-bold text-indigo-300">Descriptive Prediction Summary</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {data.aiInsights ? data.aiInsights.insights : predictions.insights}
                </p>
              </div>

              {/* Bull / Bear Scenario Cards */}
              {data.aiInsights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2.5">
                    <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" /> Bull Catalyst Scenario
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {data.aiInsights.bullScenario}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-2.5">
                    <h4 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4 text-rose-400" /> Bear Catalyst Scenario
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {data.aiInsights.bearScenario}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* News Section */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-2.5">
                <Newspaper className="h-5 w-5 text-indigo-400" />
                <h3 className="text-lg font-extrabold text-slate-100">Top Market News</h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {news.slice(0, 5).map((item: any, i) => (
                  <a
                     key={i}
                     href={item.link}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-slate-900/70 hover:border-slate-800 transition-all duration-300 group block space-y-2"
                  >
                     <div className="flex justify-between items-start gap-4">
                       <h4 className="font-semibold text-slate-200 text-sm group-hover:text-indigo-400 transition-colors leading-tight">
                         {item.title}
                       </h4>
                     </div>
                     <div className="flex items-center justify-between text-[10px] text-slate-500">
                       <span>Publisher: <strong className="text-slate-400">{item.publisher}</strong></span>
                       <span>{new Date(item.providerPublishTime).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                     </div>
                  </a>
                ))}

                {news.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-8">
                     No recent news articles available for this stock.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Recommendation, Technicals, and Key Metrics */}
          <div className="space-y-8">

            {/* BearBull Score & Indicator */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{data.aiInsights ? "BearBull AI Recommendation" : "AI Score"}</h3>
                <div className="flex items-center gap-4">
                  <span className={`text-2xl md:text-3xl font-black px-4 py-2 border rounded-xl shadow-lg leading-none ${recBadgeColor}`}>
                    {recommendationValue}
                  </span>
                  <div>
                    <span className="block text-2xl font-black text-slate-200">{confidenceValue}%</span>
                    <span className="text-xs text-slate-500">{data.aiInsights ? "AI confidence rating" : "Bullish confidence index"}</span>
                  </div>
                </div>
              </div>

              {/* Slider meter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Bearish</span>
                  <span>Neutral</span>
                  <span>Bullish</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${recommendationValue.includes("BUY")
                      ? "bg-emerald-500 shadow-md shadow-emerald-500/50"
                      : recommendationValue.includes("SELL")
                        ? "bg-rose-500 shadow-md shadow-rose-500/50"
                        : "bg-amber-500"
                      }`}
                    style={{ width: `${confidenceValue}%` }}
                  />
                </div>
              </div>

              {/* AI Key Reasons */}
              {data.aiInsights?.keyReasons && (
                <div className="space-y-2.5 border-t border-white/5 pt-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Analysis Rationale</h4>
                  <ul className="space-y-2">
                    {data.aiInsights.keyReasons.map((reason: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                        <span className="text-indigo-400 font-bold select-none mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick warning if oversold/overbought */}
              {technicals.rsi > 70 && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] leading-tight">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Warning: The asset is currently exhibiting a highly elevated RSI ({technicals.rsi.toFixed(1)}), suggesting it is heavily overbought. Prepare for potential pullback.
                </div>
              )}
              {technicals.rsi < 30 && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] leading-tight">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Opportunity: The asset exhibits a severely depressed RSI ({technicals.rsi.toFixed(1)}), indicating oversold conditions. A technical rebound may be imminent.
                </div>
              )}
            </div>

            {/* Technical Indicators */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-extrabold text-slate-100">Technical Indicators</h3>
              </div>

              <div className="space-y-3 text-xs">
                {/* SMA Golden Cross */}
                <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-slate-950/20">
                  <div>
                    <span className="block font-semibold text-slate-300">Golden Cross (SMA 50/200)</span>
                    <span className="text-[10px] text-slate-500">SMA50: {formatRupee(technicals.sma50)} | SMA200: {formatRupee(technicals.sma200)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${technicals.goldenCross ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                    {technicals.goldenCross ? "Bullish" : "Bearish"}
                  </span>
                </div>

                {/* Price vs SMA 50 */}
                <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-slate-950/20">
                  <div>
                    <span className="block font-semibold text-slate-300">Price vs 50-day SMA</span>
                    <span className="text-[10px] text-slate-500">Current vs Average threshold</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${technicals.priceVsSma50 === "Bullish" ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                    {technicals.priceVsSma50}
                  </span>
                </div>

                {/* RSI 14 */}
                <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-slate-950/20">
                  <div>
                    <span className="block font-semibold text-slate-300">Relative Strength Index (RSI)</span>
                    <span className="text-[10px] text-slate-500">Current 14-day value: {technicals.rsi.toFixed(1)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase ${technicals.rsi < 30
                    ? "text-emerald-400 bg-emerald-500/10"
                    : technicals.rsi > 70
                      ? "text-rose-400 bg-rose-500/10"
                      : "text-amber-400 bg-amber-500/10"
                    }`}>
                    {technicals.rsi < 30 ? "Oversold" : technicals.rsi > 70 ? "Overbought" : "Neutral"}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Metrics Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-base font-extrabold text-slate-100">Key Metrics (in Rupees)</h3>

              <div className="grid grid-cols-2 gap-4 text-xs">

                {/* PE Ratio */}
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30">
                  <span className="text-slate-500 block mb-1">PE Ratio</span>
                  <span className="font-extrabold text-slate-200 text-sm">
                    {quote.trailingPE?.toFixed(2) || quote.forwardPE?.toFixed(2) || "N/A"}
                  </span>
                </div>

                {/* Market Cap */}
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30">
                  <span className="text-slate-500 block mb-1">Market Cap</span>
                  <span className="font-extrabold text-slate-200 text-sm truncate">
                    {formatMarketCap(quote.marketCap)}
                  </span>
                </div>

                {/* Volume */}
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30">
                  <span className="text-slate-500 block mb-1">Volume</span>
                  <span className="font-extrabold text-slate-200 text-sm">
                    {quote.regularMarketVolume?.toLocaleString() || "N/A"}
                  </span>
                </div>

                {/* 5-Year Return */}
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30">
                  <span className="text-slate-500 block mb-1">5Y Return</span>
                  <span className={`font-extrabold text-sm flex items-center gap-0.5 ${fiveYearPerformance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {fiveYearPerformance >= 0 ? "+" : ""}{fiveYearPerformance.toFixed(1)}%
                  </span>
                </div>

                {/* 52 Week High */}
                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30 flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block">52 Week High</span>
                  </div>
                  <span className="font-extrabold text-green-400 text-sm text-right">
                    {formatRupee(quote.fiftyTwoWeekHigh)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/30 flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block">52 Week Low</span>
                  </div>
                  <span className="font-extrabold text-red-400 text-sm text-right">
                    {formatRupee(quote.fiftyTwoWeekLow)}
                  </span>
                </div>

              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

// Inline fallback loader icon
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
