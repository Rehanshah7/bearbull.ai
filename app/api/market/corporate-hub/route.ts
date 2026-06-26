import { NextRequest, NextResponse } from "next/server";
import { getCorporateHubData } from "../../../../lib/gemini";
import { checkApiAuth } from "../../middleware/authMiddleware";

export async function GET(req: NextRequest) {
  const authCheck = await checkApiAuth();
  if (!authCheck.authenticated) {
    return authCheck.response!;
  }

  try {
    const data = await getCorporateHubData();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch corporate hub data." },
      { status: 500 }
    );
  }
}
