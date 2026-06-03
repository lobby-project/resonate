import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileView, { type ProfileData } from "./ProfileView";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, age, music_signal, spotify_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: music } = await supabase
    .from("user_music_data")
    .select("genres")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from("user_photos")
    .select("url, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const data: ProfileData = {
    userId: user.id,
    name: profile?.display_name ?? "",
    age: profile?.age ?? null,
    signal: profile?.music_signal ?? null,
    genres: (music?.genres as string[] | null) ?? [],
    photos: (photoRows ?? []).map((p) => p.url),
    isSpotify: !!profile?.spotify_id,
  };

  return <ProfileView data={data} />;
}
