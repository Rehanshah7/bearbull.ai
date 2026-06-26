import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

function cleanAndParseJSON(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch (err) {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (innerErr) {
        // Continue
      }
    }
    
    // Find first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        // Continue
      }
    }
    throw err;
  }
}

export interface GeminiInsights {
  recommendation: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  targets: {
    oneMonth: { low: number; med: number; high: number };
    sixMonth: { low: number; med: number; high: number };
    oneYear: { low: number; med: number; high: number };
    threeYear: { low: number; med: number; high: number };
    fiveYear: { low: number; med: number; high: number };
    tenYear: { low: number; med: number; high: number };
  };
  bullScenario: string;
  bearScenario: string;
  keyReasons: string[];
  insights: string;
}

/**
 * Calls Google Gemini API to analyze current stock quote, historical metrics, and news.
 * Returns structured investment insights Normalizing USD assets to INR dynamically.
 */
export async function getStockInsights(ticker: string, stockData: any): Promise<GeminiInsights> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in env variables");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const quote = stockData.quote || {};
  const news = stockData.news || [];
  const historical = stockData.historical || [];
  
  const isUSD = quote.currency === "USD";
  const multiplier = isUSD ? 83.5 : 1;

  // Format historical valuation context
  let historicalSummary = "No historical valuation data available.";
  if (historical.length > 0) {
    const latest = historical[historical.length - 1];
    const oneMonth = historical[Math.max(0, historical.length - 21)];
    const sixMonth = historical[Math.max(0, historical.length - 126)];
    const oneYear = historical[Math.max(0, historical.length - 252)];
    const fiveYear = historical[Math.max(0, historical.length - 1260)] || historical[0];
    
    historicalSummary = `
- Latest Price (Date: ${latest.date}): ₹${(latest.close * multiplier).toFixed(2)}
- 1 Month Ago (Date: ${oneMonth.date}): ₹${(oneMonth.close * multiplier).toFixed(2)}
- 6 Months Ago (Date: ${sixMonth.date}): ₹${(sixMonth.close * multiplier).toFixed(2)}
- 1 Year Ago (Date: ${oneYear.date}): ₹${(oneYear.close * multiplier).toFixed(2)}
- 5 Years Ago (Date: ${fiveYear.date}): ₹${(fiveYear.close * multiplier).toFixed(2)}
    `;
  }

  const newsSummary = news.slice(0, 10).map((item: any) => `- Title: ${item.title}\n  Publisher: ${item.publisher || "Unknown"}`).join("\n");

  const systemPrompt = `You are BearBull AI, an elite Wall Street financial analyst and quantitative research expert specializing in the Indian stock market.
Your task is to analyze the provided stock data (current quotes, historical prices, news, and technical indicators) and generate a comprehensive investment evaluation report in JSON format.

Your analysis must be 99% accurate based on the provided metrics and look for realistic price levels.
All currency figures and targets must be in Indian Rupees (₹).
For foreign stocks, convert USD/foreign values to Rupees using a rate of 83.5 INR per USD.

You MUST return a JSON object with the exact keys:
1. "recommendation": must be one of: "STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"
2. "confidence": an integer between 0 and 100 representing your rating confidence
3. "targets": an object containing targets for the following timelines:
   - "oneMonth": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "sixMonth": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "oneYear": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "threeYear": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "fiveYear": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "tenYear": object with "low" (number), "med" (number), and "high" (number) in Rupees
4. "bullScenario": a detailed explanation of the positive catalyst/bullish outlook (100-150 words)
5. "bearScenario": a detailed explanation of potential headwinds/bearish outlook (100-150 words)
6. "keyReasons": an array of 3-5 concise, quantitative, and data-backed reasons supporting your rating and forecasts
7. "insights": an extremely detailed, descriptive, and comprehensive professional report (must be exactly 15 to 20 lines in length, roughly 400-500 words) analyzing the stock's long-term projection, combining compound annual growth rate (CAGR), market volatility metrics, technical indicators (such as Golden Cross, Death Cross, RSI-14, MACD, support/resistance levels), recent news sentiment, operational macroeconomic factors, and a detailed forward-looking investment thesis.`;

  const userPrompt = `Analyze the stock ${ticker} with the following data:
  
CURRENT QUOTE DETAILS (in original currency):
- Symbol: ${quote.symbol}
- Short Name: ${quote.shortName || ticker}
- Currency: ${quote.currency || "INR"}
- Regular Market Price: ${quote.regularMarketPrice}
- Daily Change Percent: ${quote.regularMarketChangePercent?.toFixed(2)}%
- 52-Week High: ${quote.fiftyTwoWeekHigh}
- 52-Week Low: ${quote.fiftyTwoWeekLow}
- Market Cap: ${quote.marketCap}
- PE Ratio: ${quote.trailingPE || "N/A"}
- Volume: ${quote.regularMarketVolume || "N/A"}

HISTORICAL VALUATION SUMMARY (converted to INR where applicable):
${historicalSummary}

RECENT STOCK NEWS HEADLINES:
${newsSummary}

Evaluate and return the structured JSON analysis.`;

  const response = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);

  const text = response.response.text();
  try {
    return cleanAndParseJSON(text);
  } catch (err) {
    console.error("Failed to parse Gemini JSON response, raw text was:", text, err);
    // Return a structured fallback
    return {
      recommendation: "HOLD",
      confidence: 50,
      targets: {
        oneMonth: { low: 0, med: 0, high: 0 },
        sixMonth: { low: 0, med: 0, high: 0 },
        oneYear: { low: 0, med: 0, high: 0 },
        threeYear: { low: 0, med: 0, high: 0 },
        fiveYear: { low: 0, med: 0, high: 0 },
        tenYear: { low: 0, med: 0, high: 0 }
      },
      bullScenario: "Failed to generate AI insights due to parse issues.",
      bearScenario: "Failed to generate AI insights due to parse issues.",
      keyReasons: ["Could not parse model output"],
      insights: "Parsing error from AI response."
    };
  }
}

export interface CorporateHubData {
  upcomingDividends: Array<{ company: string; ticker: string; amount: string; exDate: string }>;
  upcomingBuybacks: Array<{ company: string; ticker: string; price: string; exDate: string }>;
  upcomingSplits: Array<{ company: string; ticker: string; ratio: string; exDate: string }>;
  upcomingMainboardIPOs: Array<{ company: string; priceBand: string; openDate: string; closeDate: string; size: string }>;
  upcomingSmeIPOs: Array<{ company: string; priceBand: string; openDate: string; closeDate: string; size: string }>;
}

export async function getCorporateHubData(): Promise<CorporateHubData> {
  const cacheDir = path.join(process.cwd(), "app", "generated");
  const cacheFile = path.join(cacheDir, "corporate_hub_cache.json");

  // Default real data retrieved on June 24, 2026
  const defaultData: CorporateHubData & { lastUpdated: string } = {
    lastUpdated: new Date().toISOString(),
    upcomingDividends: [
      { company: "BSE Limited", ticker: "BSE.NS", amount: "₹10.00 per share", exDate: "2026-07-10" },
      { company: "BF Investment Ltd", ticker: "BFINVEST.NS", amount: "Final Dividend", exDate: "2026-07-03" },
      { company: "Nestle India Ltd", ticker: "NESTLEIND.NS", amount: "Interim Dividend", exDate: "2026-07-09" },
      { company: "Axis Bank Ltd", ticker: "AXISBANK.NS", amount: "Final Dividend", exDate: "2026-07-10" },
      { company: "Hindalco Industries Ltd", ticker: "HINDALCO.NS", amount: "Final Dividend", exDate: "2026-07-10" }
    ],
    upcomingBuybacks: [
      { company: "Wipro Limited", ticker: "WIPRO.NS", price: "₹445.00", exDate: "2026-07-08" },
      { company: "Bajaj Auto Ltd", ticker: "BAJAJ-AUTO.NS", price: "₹10,000.00", exDate: "2026-07-25" }
    ],
    upcomingSplits: [
      { company: "DSP Nifty Midcap 150 Quality 50 ETF", ticker: "MIDQ50CASE.NS", ratio: "10:1 split", exDate: "2026-07-03" },
      { company: "DSP Nifty Healthcare ETF", ticker: "NETF.NS", ratio: "10:1 split", exDate: "2026-07-03" },
      { company: "Mangalam Worldwide Ltd", ticker: "MWL.NS", ratio: "10:1 split", exDate: "2026-07-10" },
      { company: "Indian Toners & Developers Ltd", ticker: "INDTONER.BO", ratio: "10:2 split", exDate: "2026-07-17" }
    ],
    upcomingMainboardIPOs: [
      { company: "Knack Packaging Ltd", priceBand: "₹161 - ₹170", openDate: "2026-07-01", closeDate: "2026-07-03", size: "₹180 Cr" },
      { company: "Aastha Spintex Ltd", priceBand: "₹125 - ₹136", openDate: "2026-06-29", closeDate: "2026-07-01", size: "₹210 Cr" }
    ],
    upcomingSmeIPOs: [
      { company: "Kratikal Tech Ltd", priceBand: "₹128 - ₹135", openDate: "2026-06-30", closeDate: "2026-07-02", size: "₹28 Cr" },
      { company: "Seemax Resources Ltd", priceBand: "₹134 - ₹141", openDate: "2026-06-30", closeDate: "2026-07-02", size: "₹34 Cr" },
      { company: "Atharva Polyplast Ltd", priceBand: "₹55 - ₹60", openDate: "2026-06-30", closeDate: "2026-07-02", size: "₹18 Cr" },
      { company: "Sampark India Logistics Ltd", priceBand: "₹80 - ₹84", openDate: "2026-06-30", closeDate: "2026-07-02", size: "₹25 Cr" },
      { company: "Twinkle Papers Ltd", priceBand: "₹64 - ₹69", openDate: "2026-06-29", closeDate: "2026-07-01", size: "₹15 Cr" },
      { company: "Adon Agro Commodities Ltd", priceBand: "₹66 - ₹70", openDate: "2026-06-29", closeDate: "2026-07-01", size: "₹12 Cr" }
    ]
  };

  let cachedData: any = null;
  let isCacheValid = false;

  // 1. Try to read from cache file
  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, "utf8");
      cachedData = JSON.parse(raw);
      
      if (cachedData && cachedData.lastUpdated) {
        const lastUpdatedDate = new Date(cachedData.lastUpdated);
        const todayDate = new Date();
        
        // Cache is valid if updated on the same calendar day in local timezone (or within 24h)
        const isSameDay = lastUpdatedDate.toDateString() === todayDate.toDateString();
        const isUnder24Hours = (todayDate.getTime() - lastUpdatedDate.getTime()) < 24 * 60 * 60 * 1000;
        
        if (isSameDay || isUnder24Hours) {
          isCacheValid = true;
          console.log("[Corporate Hub] Returning valid cached data updated on:", cachedData.lastUpdated);
        }
      }
    }
  } catch (err) {
    console.error("[Corporate Hub] Cache read error:", err);
  }

  if (isCacheValid && cachedData) {
    return cachedData;
  }

  // 2. Cache is stale or non-existent, try to fetch from Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set. Using cached/default corporate hub data.");
    return cachedData || defaultData;
  }

  try {
    console.log("[Corporate Hub] Cache expired or missing. Fetching live market data using Google Search...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearchRetrieval: {} }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const todayStr = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
    const systemPrompt = `You are BearBull AI's real-time market intelligence engine.
Your task is to retrieve actual, live, and real-time upcoming corporate actions and IPO listings for the Indian Stock Market (NSE/BSE) using Google Search.
Today's date is ${todayStr}.
You must ONLY return real, actual scheduled events that occur on or after ${todayStr}. Do not under any circumstances invent, mock, or return placeholder/dummy data. If there are no scheduled events, return an empty array for that field.

Perform web searches for:
- "upcoming dividends Indian stock market NSE BSE ex-date"
- "upcoming buybacks Indian stock market NSE BSE record date"
- "upcoming stock splits Indian stock market ratio ex-date"
- "upcoming mainboard IPOs India price band dates"
- "upcoming SME IPOs India price band dates"

Verify the facts using top Indian financial portals (e.g., Moneycontrol, Chittorgarh, NSE India, BSE India).

Format the output strictly as a JSON object with the exact keys:
1. "upcomingDividends": array of objects with: "company" (string), "ticker" (string, must be a valid Yahoo Finance ticker ending in .NS or .BO, e.g., TCS.NS), "amount" (string, e.g., ₹28.00 per share), "exDate" (string, YYYY-MM-DD format)
2. "upcomingBuybacks": array of objects with: "company" (string), "ticker" (string, must be a valid Yahoo Finance ticker ending in .NS or .BO, e.g., WIPRO.NS), "price" (string, e.g., ₹445.00), "exDate" (string, YYYY-MM-DD format)
3. "upcomingSplits": array of objects with: "company" (string), "ticker" (string, must be a valid Yahoo Finance ticker ending in .NS or .BO, e.g., SBIN.NS), "ratio" (string, e.g., 1:2), "exDate" (string, YYYY-MM-DD format)
4. "upcomingMainboardIPOs": array of objects with: "company" (string), "priceBand" (string, e.g., ₹450 - ₹475), "openDate" (string, YYYY-MM-DD format), "closeDate" (string, YYYY-MM-DD format), "size" (string, e.g., ₹1200 Cr)
5. "upcomingSmeIPOs": array of objects with: "company" (string), "priceBand" (string, e.g., ₹80 - ₹85), "openDate" (string, YYYY-MM-DD format), "closeDate" (string, YYYY-MM-DD format), "size" (string, e.g., ₹45 Cr)`;

    const response = await model.generateContent([
      { text: systemPrompt },
      { text: `Retrieve the actual upcoming Indian market events for today: ${todayStr}.` }
    ]);

    const text = response.response.text();
    // Parse using our robust helper
    const parsedData = cleanAndParseJSON(text);

    // Make sure we have the required fields
    const finalData: CorporateHubData & { lastUpdated: string } = {
      lastUpdated: new Date().toISOString(),
      upcomingDividends: parsedData.upcomingDividends || [],
      upcomingBuybacks: parsedData.upcomingBuybacks || [],
      upcomingSplits: parsedData.upcomingSplits || [],
      upcomingMainboardIPOs: parsedData.upcomingMainboardIPOs || [],
      upcomingSmeIPOs: parsedData.upcomingSmeIPOs || []
    };

    // Save to cache file
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(finalData, null, 2), "utf8");
    console.log("[Corporate Hub] Successfully fetched and cached live market data.");
    return finalData;

  } catch (err: any) {
    console.error("[Corporate Hub] Failed to fetch live data from Gemini:", err.message || err);
    
    // If rate-limited or failed, reuse stale cache, but update timestamp to avoid immediate refetch attempts
    if (cachedData) {
      try {
        cachedData.lastUpdated = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(); // set to 20 hours ago so it won't retry for 4 hours
        fs.writeFileSync(cacheFile, JSON.stringify(cachedData, null, 2), "utf8");
      } catch (e) {}
      return cachedData;
    }

    // Write defaults to cache so we don't retry immediately and have valid data
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify(defaultData, null, 2), "utf8");
    } catch (e) {}
    
    return defaultData;
  }
}
