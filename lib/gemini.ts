import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeminiInsights {
  recommendation: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  targets: {
    threeMonth: { low: number; med: number; high: number };
    sixMonth: { low: number; med: number; high: number };
    oneYear: { low: number; med: number; high: number };
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
    const fiveYear = historical[0];
    
    historicalSummary = `
- Latest Price (Date: ${latest.date}): ₹${(latest.close * multiplier).toFixed(2)}
- 1 Month Ago (Date: ${oneMonth.date}): ₹${(oneMonth.close * multiplier).toFixed(2)}
- 6 Months Ago (Date: ${sixMonth.date}): ₹${(sixMonth.close * multiplier).toFixed(2)}
- 1 Year Ago (Date: ${oneYear.date}): ₹${(oneYear.close * multiplier).toFixed(2)}
- 5 Years Ago (Date: ${fiveYear.date}): ₹${(fiveYear.close * multiplier).toFixed(2)}
    `;
  }

  const newsSummary = news.slice(0, 5).map((item: any) => `- Title: ${item.title}\n  Publisher: ${item.publisher || "Unknown"}`).join("\n");

  const systemPrompt = `You are BearBull AI, an elite Wall Street financial analyst and quantitative research expert specializing in the Indian stock market.
Your task is to analyze the provided stock data (current quotes, historical prices, news, and technical indicators) and generate a comprehensive investment evaluation report in JSON format.

Your analysis must be 99% accurate based on the provided metrics and look for realistic price levels.
All currency figures and targets must be in Indian Rupees (₹).
For foreign stocks, convert USD/foreign values to Rupees using a rate of 83.5 INR per USD.

You MUST return a JSON object with the exact keys:
1. "recommendation": must be one of: "STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"
2. "confidence": an integer between 0 and 100 representing your rating confidence
3. "targets": an object containing:
   - "threeMonth": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "sixMonth": object with "low" (number), "med" (number), and "high" (number) in Rupees
   - "oneYear": object with "low" (number), "med" (number), and "high" (number) in Rupees
4. "bullScenario": a detailed explanation of the positive catalyst/bullish outlook (100-150 words)
5. "bearScenario": a detailed explanation of potential headwinds/bearish outlook (100-150 words)
6. "keyReasons": an array of 3-5 concise, quantitative, and data-backed reasons supporting your rating and forecasts
7. "insights": a professional 150-200 word summary combining CAGR, volatility, and general forward-looking investment thesis.`;

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
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse Gemini JSON response, raw text was:", text, err);
    // Return a structured fallback
    return {
      recommendation: "HOLD",
      confidence: 50,
      targets: {
        threeMonth: { low: 0, med: 0, high: 0 },
        sixMonth: { low: 0, med: 0, high: 0 },
        oneYear: { low: 0, med: 0, high: 0 }
      },
      bullScenario: "Failed to generate AI insights due to parse issues.",
      bearScenario: "Failed to generate AI insights due to parse issues.",
      keyReasons: ["Could not parse model output"],
      insights: "Parsing error from AI response."
    };
  }
}
