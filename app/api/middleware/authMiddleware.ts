import { AuthService } from "../services/authService";
import { NextResponse } from "next/server";

/**
 * Checks if the request is authenticated.
 * Returns either the user object (if authorized) or a 401 NextResponse.
 */
export async function checkApiAuth() {
  const user = await AuthService.getCurrentUser();
  
  if (!user) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      ),
    };
  }
  
  return { authenticated: true, user };
}
