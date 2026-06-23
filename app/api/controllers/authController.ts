import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "../services/authService";
import { createSupabaseServerClient } from "../services/supabaseClient";

export class AuthController {
  /**
   * Controller for User Registration.
   */
  static async register(req: NextRequest) {
    try {
      const { email, password, name } = await req.json();

      if (!email || !password) {
        return NextResponse.json(
          { success: false, error: "Email and password are required." },
          { status: 400 }
        );
      }

      const data = await AuthService.signUp(email, password, name);
      return NextResponse.json({
        success: true,
        message: "Registration successful. Please verify your email.",
        data
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Registration failed." },
        { status: 400 }
      );
    }
  }

  /**
   * Controller for User Login.
   */
  static async login(req: NextRequest) {
    try {
      const { email, password } = await req.json();

      if (!email || !password) {
        return NextResponse.json(
          { success: false, error: "Email and password are required." },
          { status: 400 }
        );
      }

      const data = await AuthService.signIn(email, password);
      return NextResponse.json({
        success: true,
        message: "Login successful.",
        data
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Invalid credentials." },
        { status: 401 }
      );
    }
  }

  /**
   * Controller to get OAuth Google redirect options.
   */
  static async googleLogin(req: NextRequest) {
    try {
      const searchParams = req.nextUrl.searchParams;
      const origin = searchParams.get("origin") || req.nextUrl.origin;
      const redirectTo = `${origin}/api/auth/callback`;

      const data = await AuthService.getGoogleOAuthUrl(redirectTo);
      return NextResponse.json({
        success: true,
        data
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Failed to trigger Google OAuth." },
        { status: 500 }
      );
    }
  }

  /**
   * Controller for User Sign-out.
   */
  static async logout(req: NextRequest) {
    try {
      await AuthService.signOut();
      return NextResponse.json({
        success: true,
        message: "Signed out successfully."
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Sign-out failed." },
        { status: 500 }
      );
    }
  }

  /**
   * Controller to retrieve active user & session data.
   */
  static async getSession(req: NextRequest) {
    try {
      const session = await AuthService.getSession();
      const user = await AuthService.getCurrentUser();
      return NextResponse.json({
        success: true,
        data: { session, user }
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Failed to retrieve active session." },
        { status: 500 }
      );
    }
  }

  /**
   * Controller to handle Google OAuth callback redirects.
   * Exchanges code for session cookie.
   */
  static async callback(req: NextRequest) {
    try {
      const requestUrl = new URL(req.url);
      const code = requestUrl.searchParams.get("code");
      const next = requestUrl.searchParams.get("next") || "/dashboard";

      if (code) {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return NextResponse.redirect(new URL(next, req.url));
        }
      }

      return NextResponse.redirect(new URL("/login?error=oauth-failed", req.url));
    } catch (error) {
      console.error("OAuth callback error:", error);
      return NextResponse.redirect(new URL("/login?error=server-error", req.url));
    }
  }
}
