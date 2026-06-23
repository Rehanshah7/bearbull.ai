import { NextRequest } from "next/server";
import { AuthController } from "../../controllers/authController";

export async function GET(req: NextRequest) {
  return AuthController.callback(req);
}
