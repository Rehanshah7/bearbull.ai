import { NextRequest } from "next/server";
import { StockController } from "../../controllers/stockController";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  return StockController.getStockData(req, context);
}
