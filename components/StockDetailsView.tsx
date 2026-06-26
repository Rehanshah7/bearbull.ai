"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Info,
  Compass,
  ShieldAlert,
  Star
} from "lucide-react";
import type { StockApiResponse } from "@/app/api/types/api.types";
import { isIndianMarketOpen } from "@/utils/market";

interface StockDetailsViewProps {
  ticker: string;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}

export default function StockDetailsView({
  ticker,
  onClose,
  isWatchlisted,
  onToggleWatchlist
}: StockDetailsViewProps) {
  // Component States
  const [data, setData] = useState<StockApiResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX">("1D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [intradayInterval, setIntradayInterval] = useState<"1m" | "5m" | "15m" | "1h">("15m");
  const [showSma20, setShowSma20] = useState(false);
  const [showSma50, setShowSma50] = useState(false);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [panPercent, setPanPercent] = useState<number>(100);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Chart hover calculation ref
  const chartRef = useRef<SVGSVGElement | null>(null);

  // 1. Fetch stock details (quote, historical, and interval-specific intraday)
  useEffect(() => {
    async function fetchStockDetails() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/stock/${ticker}?interval=${intradayInterval}`);
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
    fetchStockDetails();
  }, [ticker, intradayInterval]);

  // 2. Auto-Refresh quote and intraday data every 10 seconds (background updates)
  useEffect(() => {
    if (loading || error || !data) return;

    const interval = setInterval(async () => {
      if (!isIndianMarketOpen()) return;
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/stock/${ticker}?interval=${intradayInterval}`);
        const json: StockApiResponse = await res.json();
        if (json.success && json.data) {
          setData(prev => {
            if (!prev) return json.data!;
            return {
              ...prev,
              quote: json.data!.quote, // Update latest live quote
              intraday: json.data!.intraday // Update live intraday series
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
  }, [loading, error, data, ticker, intradayInterval]);

  const quote = data?.quote;
  const historical = data?.historical || [];

  // Check if current asset is an Index (e.g. SENSEX, NIFTY 50)
  const isIndex = useMemo(() => {
    if (!quote) return false;
    return (quote as any).quoteType === "INDEX" || ticker.startsWith("^");
  }, [quote, ticker]);

  // Dynamic Currency Conversion Helper (USD -> INR conversion if source is in USD)
  const conversionRate = useMemo(() => {
    if (!quote) return 1;
    if (isIndex) return 1; // Indices are expressed in points, not currency
    if (quote.currency === "USD") return 83.5; // conversion multiplier
    return 1;
  }, [quote, isIndex]);

  // Helper to format values as Rupees (₹) or raw points (for indices)
  const formatRupee = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return isIndex ? "N/A" : "₹N/A";
    const formatted = (val * conversionRate).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isIndex ? formatted : "₹" + formatted;
  };

  // Helper to format values as Rupees (₹) directly (when already in target units, e.g. from AI)
  const formatINR = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return isIndex ? "N/A" : "₹N/A";
    const formatted = val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isIndex ? formatted : "₹" + formatted;
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

  // Helper to calculate Simple Moving Average (SMA)
  const calculateSMA = (points: any[], period: number): (number | null)[] => {
    const sma: (number | null)[] = [];
    for (let i = 0; i < points.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = points.slice(i - period + 1, i + 1).reduce((acc, p) => acc + p.close, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  // 3. Timeframe Filtering
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

  // Compute stats over selected timeframe (e.g. 1D, 1W, 1M, etc.)
  const timeframeStats = useMemo(() => {
    if (timeframe === "1D" && quote) {
      const change = quote.regularMarketChange || 0;
      const changePercent = quote.regularMarketChangePercent || 0;
      return {
        change,
        changePercent,
        isUp: change >= 0
      };
    }
    if (filteredHistorical.length < 2) {
      const change = quote?.regularMarketChange || 0;
      const changePercent = quote?.regularMarketChangePercent || 0;
      return {
        change,
        changePercent,
        isUp: change >= 0
      };
    }
    const startPrice = filteredHistorical[0].close;
    const endPrice = filteredHistorical[filteredHistorical.length - 1].close;
    const change = endPrice - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;
    return {
      change,
      changePercent,
      isUp: change >= 0
    };
  }, [filteredHistorical, quote, timeframe]);

  // Calculate visible range of points based on zoom and pan sliders
  const { visiblePoints, sma20Points, sma50Points } = useMemo(() => {
    const L = filteredHistorical.length;
    const sma20Array = calculateSMA(filteredHistorical, 20);
    const sma50Array = calculateSMA(filteredHistorical, 50);

    if (L < 5) {
      return {
        visiblePoints: filteredHistorical,
        sma20Points: sma20Array,
        sma50Points: sma50Array
      };
    }

    const V = Math.max(5, Math.round(L * (zoomPercent / 100)));
    const S = Math.round((L - V) * (panPercent / 100));

    return {
      visiblePoints: filteredHistorical.slice(S, S + V),
      sma20Points: sma20Array.slice(S, S + V),
      sma50Points: sma50Array.slice(S, S + V)
    };
  }, [filteredHistorical, zoomPercent, panPercent]);

  // Map visible points to coordinates and compute paths
  const chartPathData = useMemo(() => {
    if (visiblePoints.length < 2) {
      return {
        linePath: "",
        areaPath: "",
        sma20Path: "",
        sma50Path: "",
        points: [],
        minVal: 0,
        maxVal: 0,
        paddingLeft: 65,
        paddingRight: 20,
        paddingTop: 20,
        paddingBottom: 60,
        chartWidth: 715,
        chartHeight: 220
      };
    }

    const width = 800;
    const height = 300;
    const paddingLeft = 65;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 60;

    const closePrices = visiblePoints.map(d => d.close);
    const activeSma20 = (showSma20 ? sma20Points : []).filter(v => v !== null) as number[];
    const activeSma50 = (showSma50 ? sma50Points : []).filter(v => v !== null) as number[];
    
    const allPrices = [...closePrices, ...activeSma20, ...activeSma50];
    const maxVal = Math.max(...allPrices) * 1.01;
    const minVal = Math.min(...allPrices) * 0.99;
    const priceRange = maxVal - minVal || 1;

    const minTime = new Date(visiblePoints[0].date).getTime();
    const maxTime = new Date(visiblePoints[visiblePoints.length - 1].date).getTime();
    const timeRange = maxTime - minTime || 1;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const points = visiblePoints.map((d, i) => {
      const t = new Date(d.date).getTime();
      const x = paddingLeft + ((t - minTime) / timeRange) * chartWidth;
      const y = height - paddingBottom - ((d.close - minVal) / priceRange) * chartHeight;
      return {
        x,
        y,
        price: d.close,
        volume: d.volume,
        date: ["1D", "1W"].includes(timeframe)
          ? new Date(d.date).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" }),
        sma20: sma20Points[i],
        sma50: sma50Points[i]
      };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    const areaPath = points.length > 0 
      ? [
          ...points,
          { x: points[points.length - 1].x, y: height - paddingBottom },
          { x: points[0].x, y: height - paddingBottom }
        ].map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z"
      : "";

    // Generate SMA paths
    const sma20Coords: string[] = [];
    points.forEach((p) => {
      if (p.sma20 !== null && p.sma20 !== undefined) {
        const smaY = height - paddingBottom - ((p.sma20 - minVal) / priceRange) * chartHeight;
        sma20Coords.push(`${sma20Coords.length === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${smaY.toFixed(1)}`);
      }
    });
    const sma20Path = sma20Coords.join(" ");

    const sma50Coords: string[] = [];
    points.forEach((p) => {
      if (p.sma50 !== null && p.sma50 !== undefined) {
        const smaY = height - paddingBottom - ((p.sma50 - minVal) / priceRange) * chartHeight;
        sma50Coords.push(`${sma50Coords.length === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${smaY.toFixed(1)}`);
      }
    });
    const sma50Path = sma50Coords.join(" ");

    return { linePath, areaPath, sma20Path, sma50Path, points, minVal, maxVal, paddingLeft, paddingRight, paddingTop, paddingBottom, chartWidth, chartHeight };
  }, [visiblePoints, sma20Points, sma50Points, showSma20, showSma50, timeframe]);

  // Calculate volume bars to overlay at bottom
  const volumeBars = useMemo(() => {
    const { points, paddingBottom, chartWidth } = chartPathData;
    if (!points || points.length === 0) return [];
    const height = 300;

    const volumes = points.map(p => p.volume || 0);
    const maxVolume = Math.max(...volumes) || 1;
    const maxBarHeight = 45;
    const chartBottom = height - paddingBottom;

    return points.map((p, idx) => {
      const vol = p.volume || 0;
      const barH = (vol / maxVolume) * maxBarHeight;
      const barY = chartBottom - barH;
      const barWidth = Math.max(1.5, (chartWidth / points.length) * 0.7);

      let isUp = true;
      if (idx > 0) {
        isUp = p.price >= points[idx - 1].price;
      } else if (idx === 0 && visiblePoints[0] && filteredHistorical) {
        const absoluteIdx = filteredHistorical.indexOf(visiblePoints[0]);
        if (absoluteIdx > 0) {
          isUp = visiblePoints[0].close >= filteredHistorical[absoluteIdx - 1].close;
        }
      }

      return {
        x: p.x - barWidth / 2,
        y: barY,
        width: barWidth,
        height: barH,
        color: isUp ? "rgba(16, 185, 129, 0.22)" : "rgba(244, 63, 94, 0.22)", // Semi-transparent emerald or rose
        border: isUp ? "rgba(16, 185, 129, 0.35)" : "rgba(244, 63, 94, 0.35)"
      };
    });
  }, [chartPathData, visiblePoints, filteredHistorical]);

  // Handle crosshair tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const { points } = chartPathData;
    if (!points || !points.length || !chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 300 / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let closest = points[0];
    let minDist = Math.abs(points[0].x - mouseX);
    let closestIndex = 0;

    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = points[i];
        closestIndex = i;
      }
    }

    setHoveredPoint({
      ...closest,
      index: closestIndex,
      clientX: closest.x / scaleX,
      clientY: closest.y / scaleY
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Determine trajectory direction
  const isPeriodUp = useMemo(() => {
    if (visiblePoints.length < 2) return true;
    const startPrice = visiblePoints[0].price;
    const endPrice = visiblePoints[visiblePoints.length - 1].price;
    return endPrice >= startPrice;
  }, [visiblePoints]);

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
    const rsiData = closePrices.slice(-100);
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
    if (rsi < 30) bullCount += 2;
    else if (rsi > 70) bearCount += 2;

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
          "3Y": { low: 0, med: 0, high: 0 },
          "5Y": { low: 0, med: 0, high: 0 },
          "10Y": { low: 0, med: 0, high: 0 },
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

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const dailyVol = Math.sqrt(variance);

    const totalDays = (new Date(historical[historical.length - 1].date).getTime() - new Date(historical[0].date).getTime()) / (1000 * 60 * 60 * 24);
    const years = totalDays / 365.25 || 1;

    const cagr = Math.pow(prices[prices.length - 1] / prices[0], 1 / years) - 1;
    const volatility = dailyVol * Math.sqrt(252);

    const project = (days: number) => {
      const t = days / 365.25;
      const expectedFactor = Math.exp((cagr - 0.5 * volatility * volatility) * t);
      const median = latestPrice * expectedFactor;

      const logStdDev = volatility * Math.sqrt(t);
      const low = latestPrice * Math.exp(Math.log(expectedFactor) - 1.645 * logStdDev);
      const high = latestPrice * Math.exp(Math.log(expectedFactor) + 1.645 * logStdDev);

      return { low, med: median, high };
    };

    const targets = {
      "1M": project(30),
      "6M": project(182),
      "1Y": project(365),
      "3Y": project(1095),
      "5Y": project(1825),
      "10Y": project(3650),
    };

    let riskClassification = "Moderate Market Risk";
    if (volatility > 0.35) riskClassification = "High-Vol / Speculative Risk Profile";
    else if (volatility < 0.15) riskClassification = "Low Volatility / Conservative Profile";

    let trendDescription = "experiencing consolidation";
    if (cagr > 0.20) trendDescription = "exhibiting stellar double-digit CAGR growth";
    else if (cagr > 0.05) trendDescription = "showing solid linear gains";
    else if (cagr < -0.05) trendDescription = "experiencing downward pressure and structural headwinds";

    const insights = `[BEARBULL QUANTITATIVE REPORT]
Our proprietary quantitative model has evaluated the historical trading performance and volatility metrics of ${quote.symbol} over a ${years.toFixed(1)}-year observation period. The stock operates with an annualized volatility of ${(volatility * 100).toFixed(1)}%, which classifies it under a "${riskClassification}" profile, indicating ${volatility > 0.30 ? 'substantial price dispersion and active trading swings' : 'stable trading bands with moderate fluctuations'}. Concurrently, the stock has exhibited a compound annual growth rate (CAGR) of ${(cagr * 100).toFixed(1)}% (${trendDescription}).

From a mid-term perspective, our 1-month projections place the median target at ${formatRupee(targets["1M"].med)}, with a support floor of ${formatRupee(targets["1M"].low)} and a resistance ceiling of ${formatRupee(targets["1M"].high)}. Looking further to 6 months, the median estimate moves to ${formatRupee(targets["6M"].med)} (bearish floor of ${formatRupee(targets["6M"].low)} and bullish ceiling of ${formatRupee(targets["6M"].high)}). On a 1-year horizon, the target points to ${formatRupee(targets["1Y"].med)}, presenting a potential upside of up to ${formatRupee(targets["1Y"].high)} if structural support holds.

Extending the forecast timeline into the long term, the 3-year statistical projection models a median price of ${formatRupee(targets["3Y"].med)}, with a bullish expansion peak of ${formatRupee(targets["3Y"].high)} and a conservative valuation boundary at ${formatRupee(targets["3Y"].low)}. On a 5-year macro cycle, the stock's model indicates a median value of ${formatRupee(targets["5Y"].med)}, with a high boundary of ${formatRupee(targets["5Y"].high)} and a low boundary of ${formatRupee(targets["5Y"].low)}. Finally, our ultra-long-term 10-year terminal forecast projects a median price target of ${formatRupee(targets["10Y"].med)}, outlining a wide logarithmic variance between the absolute bear target of ${formatRupee(targets["10Y"].low)} and the full bull-market target of ${formatRupee(targets["10Y"].high)}. Investors are advised to manage risk dynamically given the high-volatility terminal dispersion.`;

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
      <div className="flex items-center justify-center p-16">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-semibold">Generating closeable real-time analytics in Rupees...</p>
        </div>
      </div>
    );
  }

  // UI Error State
  if (error || !quote) {
    return (
      <div className="p-8 rounded-2xl border border-red-500/25 bg-red-500/5 text-center space-y-4">
        <Info className="h-10 w-10 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-200">Lookup Failure</h3>
        <p className="text-sm text-slate-400">{error || "Unable to retrieve stock data. Symbol may be incorrect or delisted."}</p>
        <button onClick={onClose} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer">
          Dismiss Analytics
        </button>
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
    <div className="space-y-8 animate-fadeIn duration-500">

      {/* Detail Header / Nav Bar with Watchlist & Dismiss Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Clock className={`h-4 w-4 ${isRefreshing ? "text-indigo-400 animate-spin" : "text-slate-500"}`} />
          <span className="text-xs text-slate-400 font-semibold">
            {isRefreshing ? "Updating quote..." : "Auto-updates every 10s"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Watchlist Toggle Button */}
          <button
            onClick={onToggleWatchlist}
            className={`px-4 py-2 cursor-pointer rounded-xl border transition-all duration-300 flex items-center gap-2 text-xs font-bold ${isWatchlisted
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
          >
            <Star className={`h-4 w-4 ${isWatchlisted ? "fill-amber-400 text-amber-400" : ""}`} />
            {isWatchlisted ? "In Watchlist" : "Add to Watchlist"}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 cursor-pointer rounded-xl bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600/20 hover:border-rose-500/40 text-rose-400 hover:text-rose-200 transition-all duration-300 flex items-center gap-2 text-xs font-bold"
          >
            <X className="h-4 w-4" /> Close Analytics
          </button>
        </div>
      </div>

      {/* Stock Headline Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
              {quote.symbol}
            </span>
            <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              {quote.fullExchangeName}
            </span>
          </div>
          <h1 className="text-xl md:text-3xl font-black text-slate-100 tracking-tight mt-2">
            {quote.longName || quote.shortName || quote.symbol}
          </h1>
        </div>

        <div className="text-left md:text-right space-y-1">
          <div className="flex items-baseline gap-3 md:justify-end">
            <span className="text-2xl md:text-4xl font-black text-slate-100">
              {formatRupee(quote.regularMarketPrice)}
            </span>
            <span className={`flex items-center gap-0.5 text-xs md:text-sm font-bold px-2 py-0.5 rounded-lg ${timeframeStats.isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {timeframeStats.isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {formatRupee(timeframeStats.change)} ({timeframeStats.changePercent >= 0 ? "+" : ""}{timeframeStats.changePercent.toFixed(2)}%) <span className="ml-1 text-[10px] opacity-70">{timeframe}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Chart, Predictions */}
        <div className="lg:col-span-2 space-y-8">

          {/* SVG Interactive Chart Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-100">Interactive Technical Chart</h3>
                <p className="text-xs text-slate-400">Zoom, pan, hover, and overlay moving averages for minute-frame analysis</p>
              </div>

              {/* Timeframe selector & Intraday Minute Frame selector */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "MAX"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTimeframe(t);
                        setZoomPercent(100);
                        setPanPercent(100);
                        setHoveredPoint(null);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${timeframe === t ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {(timeframe === "1D" || timeframe === "1W") && (
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-black text-slate-500 uppercase px-1">Intraday:</span>
                    {(["1m", "5m", "15m", "1h"] as const).map((intv) => (
                      <button
                        key={intv}
                        type="button"
                        onClick={() => {
                          setIntradayInterval(intv);
                          setHoveredPoint(null);
                        }}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${intradayInterval === intv ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        {intv}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Legend details */}
            <div className="flex flex-wrap gap-3 justify-between items-center text-xs text-slate-400 bg-slate-950/60 px-4 py-2.5 rounded-xl border border-white/5">
              {hoveredPoint ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1 w-full justify-between sm:justify-start">
                  <span>Time: <strong className="text-indigo-400">{hoveredPoint.date}</strong></span>
                  <span>Price: <strong className="text-white">{formatRupee(hoveredPoint.price)}</strong></span>
                  <span>Vol: <strong className="text-slate-300">{hoveredPoint.volume?.toLocaleString() || "0"}</strong></span>
                  {showSma20 && hoveredPoint.sma20 !== null && hoveredPoint.sma20 !== undefined && (
                    <span>SMA20: <strong className="text-amber-400">{formatRupee(hoveredPoint.sma20)}</strong></span>
                  )}
                  {showSma50 && hoveredPoint.sma50 !== null && hoveredPoint.sma50 !== undefined && (
                    <span>SMA50: <strong className="text-purple-400">{formatRupee(hoveredPoint.sma50)}</strong></span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-6 gap-y-1 w-full justify-between sm:justify-start">
                  <span>Trend: <strong className={isPeriodUp ? "text-emerald-400" : "text-rose-400"}>{isPeriodUp ? "UPWARD" : "DOWNWARD"}</strong></span>
                  <span>Start: <strong className="text-slate-300">{formatRupee(visiblePoints[0]?.close)}</strong></span>
                  <span>End: <strong className="text-slate-300">{formatRupee(visiblePoints[visiblePoints.length - 1]?.close)}</strong></span>
                  <span>Points: <strong className="text-indigo-400">{visiblePoints.length}</strong></span>
                </div>
              )}
            </div>

            {/* SVG Chart Render */}
            <div className="relative bg-slate-950/20 rounded-xl p-2 border border-white/5">
              <svg
                ref={chartRef}
                viewBox="0 0 800 300"
                className="w-full h-auto cursor-crosshair overflow-visible select-none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPeriodUp ? "#10b981" : "#f43f5e"} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={isPeriodUp ? "#10b981" : "#f43f5e"} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Dynamic Price Grid lines */}
                {chartPathData.minVal !== undefined && chartPathData.maxVal !== undefined && (() => {
                  const range = chartPathData.maxVal - chartPathData.minVal;
                  const steps = 4;
                  return Array.from({ length: steps + 1 }).map((_, i) => {
                    const price = chartPathData.maxVal - (range * i) / steps;
                    const y = chartPathData.paddingTop + (chartPathData.chartHeight * i) / steps;
                    return (
                      <g key={i}>
                        <line
                          x1={chartPathData.paddingLeft}
                          y1={y}
                          x2={800 - chartPathData.paddingRight}
                          y2={y}
                          stroke="#1e293b"
                          strokeWidth="0.5"
                          strokeDasharray="4,4"
                        />
                        <text
                          x={chartPathData.paddingLeft - 8}
                          y={y + 3}
                          textAnchor="end"
                          fill="#64748b"
                          className="text-[9px] font-medium"
                        >
                          {formatRupee(price)}
                        </text>
                      </g>
                    );
                  });
                })()}

                {/* Volume Bars overlay at the bottom */}
                {volumeBars.map((bar, idx) => (
                  <rect
                    key={idx}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill={bar.color}
                    stroke={bar.border}
                    strokeWidth="0.5"
                  />
                ))}

                {/* Area under the price line */}
                {chartPathData.areaPath && (
                  <path d={chartPathData.areaPath} fill="url(#chartGradient)" />
                )}

                {/* Main price line */}
                {chartPathData.linePath && (
                  <path
                    d={chartPathData.linePath}
                    fill="none"
                    stroke={isPeriodUp ? "#10b981" : "#f43f5e"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* SMA 20 Overlay */}
                {showSma20 && chartPathData.sma20Path && (
                  <path
                    d={chartPathData.sma20Path}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="1,0"
                  />
                )}

                {/* SMA 50 Overlay */}
                {showSma50 && chartPathData.sma50Path && (
                  <path
                    d={chartPathData.sma50Path}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}

                {/* X-Axis labels at start, middle, and end */}
                {chartPathData.points.length >= 2 && (() => {
                  const pts = chartPathData.points;
                  const labelIndexes = [0, Math.floor(pts.length / 2), pts.length - 1];
                  return labelIndexes.map((idxVal, index) => {
                    const pt = pts[idxVal];
                    if (!pt) return null;
                    return (
                      <text
                        key={index}
                        x={pt.x}
                        y={300 - 15}
                        textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
                        fill="#64748b"
                        className="text-[9px] font-bold"
                      >
                        {pt.date}
                      </text>
                    );
                  });
                })()}

                {/* Active Hover crosshair & dot */}
                {hoveredPoint && (
                  <>
                    {/* Vertical line */}
                    <line
                      x1={hoveredPoint.x}
                      y1={chartPathData.paddingTop}
                      x2={hoveredPoint.x}
                      y2={300 - chartPathData.paddingBottom}
                      stroke="#818cf8"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                    {/* Horizontal line */}
                    <line
                      x1={chartPathData.paddingLeft}
                      y1={hoveredPoint.y}
                      x2={800 - chartPathData.paddingRight}
                      y2={hoveredPoint.y}
                      stroke="#818cf8"
                      strokeWidth="1"
                      strokeDasharray="3,3"
                    />
                    {/* Intersect circle */}
                    <circle
                      cx={hoveredPoint.x}
                      cy={hoveredPoint.y}
                      r="4.5"
                      fill="#818cf8"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    {/* Y-Axis Hover price background bubble */}
                    <rect
                      x={2}
                      y={hoveredPoint.y - 7}
                      width={chartPathData.paddingLeft - 4}
                      height={14}
                      rx={3}
                      fill="#818cf8"
                    />
                    <text
                      x={chartPathData.paddingLeft - 6}
                      y={hoveredPoint.y + 3}
                      textAnchor="end"
                      fill="#0f172a"
                      className="text-[8px] font-black"
                    >
                      {formatRupee(hoveredPoint.price)}
                    </text>
                  </>
                )}
              </svg>

              {/* Floating Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl pointer-events-none text-[11px] text-slate-300 space-y-1 z-30 backdrop-blur-md"
                  style={{
                    left: `${hoveredPoint.clientX + 12}px`,
                    top: `${hoveredPoint.clientY - 45}px`,
                    transform: hoveredPoint.clientX > 520 ? "translateX(-110%)" : "none"
                  }}
                >
                  <div className="font-extrabold text-slate-100 border-b border-white/5 pb-1 mb-1">{hoveredPoint.date}</div>
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">Price:</span>
                    <span className="font-extrabold text-white">{formatRupee(hoveredPoint.price)}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-bold text-slate-300">{hoveredPoint.volume?.toLocaleString() || "0"}</span>
                  </div>
                  {showSma20 && hoveredPoint.sma20 !== null && hoveredPoint.sma20 !== undefined && (
                    <div className="flex justify-between gap-6 text-amber-400">
                      <span>SMA 20:</span>
                      <span className="font-bold">{formatRupee(hoveredPoint.sma20)}</span>
                    </div>
                  )}
                  {showSma50 && hoveredPoint.sma50 !== null && hoveredPoint.sma50 !== undefined && (
                    <div className="flex justify-between gap-6 text-purple-400">
                      <span>SMA 50:</span>
                      <span className="font-bold">{formatRupee(hoveredPoint.sma50)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chart Control Panels (Zoom, Pan & Indicators) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-4">
              {/* Zoom & Pan Sliders */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Zoom & Pan controls</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoomPercent(prev => Math.max(10, prev - 15))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-extrabold text-slate-300 transition-colors"
                      title="Zoom In"
                    >
                      (+) In
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomPercent(prev => Math.min(100, prev + 15))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-extrabold text-slate-300 transition-colors"
                      title="Zoom Out"
                    >
                      (-) Out
                    </button>
                    <button
                      type="button"
                      onClick={() => { setZoomPercent(100); setPanPercent(100); }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-extrabold text-slate-300 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Window Range */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-12 text-[10px] uppercase font-semibold">Window:</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={zoomPercent}
                      onChange={(e) => setZoomPercent(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <span className="text-slate-300 font-bold w-8 text-right text-[10px]">{zoomPercent}%</span>
                  </div>

                  {/* Horizontal shift */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-12 text-[10px] uppercase font-semibold">Shift X:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={panPercent}
                      disabled={zoomPercent === 100}
                      onChange={(e) => setPanPercent(Number(e.target.value))}
                      className={`flex-1 accent-indigo-500 h-1 bg-slate-950 rounded-lg ${zoomPercent === 100 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                    />
                    <span className="text-slate-300 font-bold w-8 text-right text-[10px]">{panPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Technical indicators overlay checkboxes */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Moving Average overlays</span>
                <div className="flex flex-wrap gap-x-4 gap-y-2.5 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={showSma20}
                      onChange={(e) => setShowSma20(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    SMA 20 (Yellow)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={showSma50}
                      onChange={(e) => setShowSma50(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                    />
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                    SMA 50 (Purple)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* FUTURE PRICE PREDICTIONS & STATISTICAL INSIGHTS */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-extrabold text-slate-100">Future Price Predictions (INR)</h3>
            </div>

            {/* Table of Forecast Targets */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {data.aiInsights ? (
                <>
                  {[
                    { label: "1-Month Forecast", key: "oneMonth" },
                    { label: "6-Month Forecast", key: "sixMonth" },
                    { label: "1-Year Forecast", key: "oneYear" },
                    { label: "3-Year Forecast", key: "threeYear" },
                    { label: "5-Year Forecast", key: "fiveYear" },
                    { label: "10-Year Forecast", key: "tenYear" }
                  ].map((item) => {
                    const target = data.aiInsights!.targets[item.key as "oneMonth" | "sixMonth" | "oneYear" | "threeYear" | "fiveYear" | "tenYear"] || { low: 0, med: 0, high: 0 };
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
                (["1M", "6M", "1Y", "3Y", "5Y", "10Y"] as const).map((period) => {
                  const target = predictions.targets[period];
                  return (
                    <div key={period} className="p-4 rounded-xl border border-white/5 bg-slate-950/40 space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs font-bold text-slate-400">
                          {period === "1M" ? "1-Month Forecast" : period === "6M" ? "6-Month Forecast" : period === "1Y" ? "1-Year Forecast" : period === "3Y" ? "3-Year Forecast" : period === "5Y" ? "5-Year Forecast" : "10-Year Forecast"}
                        </span>
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
        </div>

        {/* RIGHT COLUMN: Recommendation, Technicals, and Key Metrics */}
        <div className="space-y-8">

          {/* BearBull Score & Indicator */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none"></div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{data.aiInsights ? "BearBull AI Recommendation" : "AI Score"}</h3>
              <div className="flex items-center gap-4">
                <span className={`text-xl md:text-2xl font-black px-4 py-2 border rounded-xl shadow-lg leading-none ${recBadgeColor}`}>
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

              {/* 52 Week Low */}
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
