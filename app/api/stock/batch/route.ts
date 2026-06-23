import { NextRequest, NextResponse } from "next/server";
import { StockService } from "../../services/stockService";
import { checkApiAuth } from "../../middleware/authMiddleware";

export async function GET(req: NextRequest) {
  // Enforce authentication check
  const authCheck = await checkApiAuth();
  if (!authCheck.authenticated) {
    return authCheck.response!;
  }

  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") || "";
  const sortParam = searchParams.get("sort") || "desc"; // "desc" (high to low) is the default
  
  if (!symbolsParam.trim()) {
    return NextResponse.json(
      { success: false, error: "Symbols query parameter is required." },
      { status: 400 }
    );
  }

  const symbols = symbolsParam
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  try {
    const quotes = await StockService.getMultipleQuotes(symbols);
    
    // Sort the quotes by regularMarketChangePercent in the backend
    const sortedQuotes = [...quotes].sort((a: any, b: any) => {
      const changeA = a?.regularMarketChangePercent ?? 0;
      const changeB = b?.regularMarketChangePercent ?? 0;
      return sortParam === "asc" ? changeA - changeB : changeB - changeA;
    });

    return NextResponse.json({ success: true, data: sortedQuotes });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batch quotes." },
      { status: 500 }
    );
  }
}
