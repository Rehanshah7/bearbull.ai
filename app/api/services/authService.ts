import { createSupabaseServerClient } from "./supabaseClient";

export class AuthService {
  /**
   * Registers a new user with email, password, and metadata.
   */
  static async signUp(email: string, password: string, name?: string) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Signs in a user using email & password.
   */
  static async signIn(email: string, password: string) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Generates a Google OAuth redirect URL.
   */
  static async getGoogleOAuthUrl(redirectTo: string) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Signs out the active user session.
   */
  static async signOut() {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Retrieves the current authenticated user details.
   */
  static async getCurrentUser() {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  }

  /**
   * Retrieves the current session details.
   */
  static async getSession() {
    const supabase = await createSupabaseServerClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return null;
    return session;
  }
}
