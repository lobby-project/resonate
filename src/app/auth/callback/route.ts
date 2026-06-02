import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAggregatedTopArtists, getTopTracks } from "@/lib/spotify";
import { generateMusicSignal } from "@/lib/music-signal";

// Handles the Supabase OAuth callback.
// 1. Exchanges the code for a session
// 2. If the user has no music_signal yet, fetches Spotify data + generates one
// 3. Routes to /onboarding (new) or /events (returning)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Check if profile already onboarded
  const { data: profile } = await supabase
    .from("users")
    .select("onboarded, music_signal")
    .eq("id", user.id)
    .single();

  // Generate Music Signal once, if missing.
  if (!profile?.music_signal) {
    // Supabase stores the Spotify provider token in the session.
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

        // store signal on users
        await supabase
          .from("users")
          .update({ music_signal: result.signal, spotify_id: user.id })
          .eq("id", user.id);

        // store raw music data (top artists + genre distribution)
        await supabase.from("user_music_data").upsert({
          user_id: user.id,
          top_artists: artists.slice(0, 30),
          audio_features: { avgPopularity: result.avgPopularity },
          genres: Object.keys(result.genreDistribution),
        });
      } catch (e) {
        // If Spotify fetch fails, continue — onboarding can retry / fallback.
        console.error("Music Signal generation failed:", e);
      }
    }
  }

  // Route: onboarded → app; else → onboarding
  const dest = profile?.onboarded ? "/events" : "/onboarding";
  return NextResponse.redirect(`${origin}${next ?? dest}`);
}
