import { NextRequest } from "next/server";
import { StockController } from "../../controllers/stockController";

export async function GET(req: NextRequest) {
  return StockController.searchStocks(req);
}
