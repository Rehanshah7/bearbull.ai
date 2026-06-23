import { NextRequest, NextResponse } from "next/server";
import { StockService } from "../services/stockService";
import { checkApiAuth } from "../middleware/authMiddleware";
import { getStockInsights } from "../../../lib/gemini";

export class StockController {
  /**
   * Controller to handle GET requests for stock quote and historical data.
   * Protected: requires valid authenticated session.
   */
  static async getStockData(
    req: NextRequest,
    context: { params: Promise<{ ticker: string }> }
  ) {
    // Enforce authentication check
    const authCheck = await checkApiAuth();
    if (!authCheck.authenticated) {
      return authCheck.response!;
    }

    const { ticker } = await context.params;

    if (!ticker) {
      return NextResponse.json(
        { success: false, error: "Stock ticker is required." },
        { status: 400 }
      );
    }

    try {
      // 1. Try direct quote and history retrieval by symbol
      const data = await StockService.getStockData(ticker);
      
      // Fetch Gemini AI insights and append to data
      try {
        const aiInsights = await getStockInsights(ticker, data);
        (data as any).aiInsights = aiInsights;
      } catch (geminiErr) {
        console.error("Gemini API call failed:", geminiErr);
        (data as any).aiInsights = null;
      }

      return NextResponse.json({ success: true, data });
    } catch (error: any) {
      // 2. Smart Fallback: If direct quote fails, try searching the query to find a matched symbol
      try {
        const searchResults = await StockService.searchStocks(ticker);
        if (searchResults && searchResults.length > 0) {
          const firstSymbol = searchResults[0].symbol;
          if (firstSymbol && firstSymbol.toUpperCase() !== ticker.toUpperCase()) {
            const data = await StockService.getStockData(firstSymbol);
            try {
              const aiInsights = await getStockInsights(firstSymbol, data);
              (data as any).aiInsights = aiInsights;
            } catch (geminiErr) {
              console.error("Gemini API call failed for fallback symbol:", geminiErr);
              (data as any).aiInsights = null;
            }
            return NextResponse.json({ success: true, data });
          }
        }
      } catch (searchErr) {
        // Fallback search failed; ignore and report original error
      }

      const status = error.message.includes("not found") ? 404 : 500;
      return NextResponse.json(
        { success: false, error: error.message || "An error occurred while fetching stock details." },
        { status }
      );
    }
  }

  /**
   * Controller to handle GET requests for autocomplete stock suggestions.
   * Protected: requires valid authenticated session.
   */
  static async searchStocks(req: NextRequest) {
    // Enforce authentication check
    const authCheck = await checkApiAuth();
    if (!authCheck.authenticated) {
      return authCheck.response!;
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    try {
      const suggestions = await StockService.searchStocks(query);
      return NextResponse.json({ success: true, data: suggestions });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "An error occurred during search." },
        { status: 500 }
      );
    }
  }
}
