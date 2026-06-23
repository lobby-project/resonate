"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateManualSignal } from "@/lib/music-signal";

// Save profile basics (name, age, gender, optional IG handle) to users table.
export async function saveBasicInfo(
  name: string,
  age: number,
  gender: string,
  igHandle: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // normalize IG: strip a leading @, blank → null
  const ig = igHandle.trim().replace(/^@+/, "");

  const { error } = await supabase
    .from("users")
    .update({
      display_name: name.trim(),
      age,
      gender,
      ig_handle: ig || null,
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

// Save selected genres + generate the music signal from them (no reveal UI).
// `genres` already rolled up by the client (EDM subgenres + "ELECTRONIC / EDM"),
// so generateManualSignal — which matches against the 12 big categories — still
// produces a signal, and profile/events/match keep working on the big categories.
export async function saveGenresWithSignal(genres: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { signal } = generateManualSignal(genres);

  const { error: sErr } = await supabase
    .from("users")
    .update({ music_signal: signal })
    .eq("id", user.id);
  if (sErr) throw new Error(sErr.message);

  // upsert so it works whether or not the row exists yet
  const { error: gErr } = await supabase
    .from("user_music_data")
    .upsert({ user_id: user.id, genres }, { onConflict: "user_id" });
  if (gErr) throw new Error(gErr.message);

  return { signal };
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

// Persist a drag-reordered photo order → sort_order = array index.
export async function savePhotoOrder(orderedUrls: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await Promise.all(
    orderedUrls.map((url, i) =>
      supabase
        .from("user_photos")
        .update({ sort_order: i })
        .eq("user_id", user.id)
        .eq("url", url)
    )
  );
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

// Prefill: the display name we may already have (e.g. from the Google profile).
export async function getProfileBasics(): Promise<{ displayName: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { displayName: "" };

  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return { displayName: profile?.display_name ?? "" };
}
