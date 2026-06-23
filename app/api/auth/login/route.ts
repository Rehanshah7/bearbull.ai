import { NextRequest } from "next/server";
import { AuthController } from "../../controllers/authController";

export async function POST(req: NextRequest) {
  return AuthController.login(req);
}
