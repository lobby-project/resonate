import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAggregatedTopArtists, getTopTracks } from "@/lib/spotify";
import { generateMusicSignal } from "@/lib/music-signal";

// Handles the Supabase OAuth callback.
// 1. Exchanges the code for a session
// 2. If the user has no music_signal yet AND signed in with Spotify, builds one
// 3. Routes to /onboarding (new) or /events (returning)
//
// IMPORTANT (cookie persistence fix):
// In a Route Handler, cookies written via next/headers cookies() do NOT reliably
// attach to a NextResponse.redirect(). So we bind the Supabase client's cookie
// writes into an array and explicitly set them on the redirect response we return.
// This guarantees the browser receives the session Set-Cookie headers.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // Collect cookies Supabase wants to set during the exchange.
  const pending: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pending.push(c));
        },
      },
    }
  );

  // helper: build a redirect response with all session cookies attached
  const redirectWithCookies = (path: string) => {
    const res = NextResponse.redirect(`${origin}${path}`);
    pending.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options)
    );
    return res;
  };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[CB] exchange error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded, music_signal")
    .eq("id", user.id)
    .single();

  // Generate Music Signal once, if missing AND signed in with Spotify.
  // Google / phone users build their signal manually during onboarding.
  const provider = user.app_metadata?.provider;
  if (!profile?.music_signal && provider === "spotify") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (providerToken) {
      try {
        const [artists, tracks] = await Promise.all([
          getAggregatedTopArtists(providerToken),
          getTopTracks(providerToken, "medium_term", 50).catch(() => []),
        ]);
        const result = generateMusicSignal(artists, tracks);

        await supabase
          .from("users")
          .update({ music_signal: result.signal, spotify_id: user.id })
          .eq("id", user.id);

        await supabase.from("user_music_data").upsert({
          user_id: user.id,
          top_artists: artists.slice(0, 30),
          audio_features: { avgPopularity: result.avgPopularity },
          genres: Object.keys(result.genreDistribution),
        });
      } catch (e) {
        console.error("Music Signal generation failed:", e);
      }
    }
  }

  const dest = profile?.onboarded ? "/events" : "/onboarding";
  return redirectWithCookies(next ?? dest);
}
