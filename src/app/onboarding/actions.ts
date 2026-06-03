"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateManualSignal } from "@/lib/music-signal";

// MANUAL signal build for Google / phone users (no Spotify data).
// Generates a signal from hand-picked genres, stores signal + genres + typed artists.
export async function buildManualSignal(
  genres: string[],
  artists: string[]
): Promise<{ signal: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const result = generateManualSignal(genres);

  await supabase.from("users").update({ music_signal: result.signal }).eq("id", user.id);

  await supabase.from("user_music_data").upsert(
    {
      user_id: user.id,
      genres,
      top_artists: artists.filter(Boolean).map((name) => ({ name })),
    },
    { onConflict: "user_id" }
  );

  return { signal: result.signal };
}

// Save basic info (name, age) to users table
export async function saveBasicInfo(name: string, age: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("users")
    .update({ display_name: name.trim(), age })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

// Save selected genres to user_music_data
export async function saveGenres(genres: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // upsert so it works whether or not the row exists (signal step may have created it)
  const { error } = await supabase
    .from("user_music_data")
    .upsert({ user_id: user.id, genres }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

// Save a photo URL (called after client uploads to Storage)
export async function savePhotoUrl(url: string, sortOrder: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_photos")
    .insert({ user_id: user.id, url, sort_order: sortOrder });

  if (error) throw new Error(error.message);
}

// Remove a photo by url (used if user deletes during onboarding)
export async function removePhotoUrl(url: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("user_photos").delete().eq("user_id", user.id).eq("url", url);
}

// Finalize onboarding → mark onboarded, go to app
export async function completeOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("users")
    .update({ onboarded: true })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect("/events");
}

// Fetch the user's generated music signal (for the reveal step)
export async function getMySignal(): Promise<{
  signal: string | null;
  topArtists: string[];
  displayName: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signal: null, topArtists: [], displayName: "" };

  const { data: profile } = await supabase
    .from("users")
    .select("music_signal, display_name")
    .eq("id", user.id)
    .single();

  const { data: music } = await supabase
    .from("user_music_data")
    .select("top_artists")
    .eq("user_id", user.id)
    .single();

  // top_artists is jsonb array of {name,...}
  const topArtists =
    (music?.top_artists as { name?: string }[] | null)
      ?.slice(0, 3)
      .map((a) => a?.name)
      .filter((n): n is string => !!n) ?? [];

  return {
    signal: profile?.music_signal ?? null,
    topArtists,
    displayName: profile?.display_name ?? "",
  };
}
