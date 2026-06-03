"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateManualSignal } from "@/lib/music-signal";

// Update name + age from profile edit.
export async function updateBasicInfo(name: string, age: number) {
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
  revalidatePath("/profile");
}

// Update genres. For manual (non-Spotify) users, regenerate the Music Signal
// from the new genres. Spotify users keep their auto-generated signal.
export async function updateGenres(genres: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("user_music_data")
    .upsert({ user_id: user.id, genres }, { onConflict: "user_id" });

  // regenerate signal only for manual users (no spotify_id)
  const { data: profile } = await supabase
    .from("users")
    .select("spotify_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.spotify_id) {
    const result = generateManualSignal(genres);
    await supabase.from("users").update({ music_signal: result.signal }).eq("id", user.id);
  }

  revalidatePath("/profile");
}

// Add a photo URL (client uploads to Storage first).
export async function addPhoto(url: string, sortOrder: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_photos")
    .insert({ user_id: user.id, url, sort_order: sortOrder });
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

// Remove a photo by url.
export async function removePhoto(url: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("user_photos").delete().eq("user_id", user.id).eq("url", url);
  revalidatePath("/profile");
}

// Sign out → back to login.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
