"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Create a post. Must tag exactly ONE of: an event OR an artist (DB enforces XOR).
export async function createPost(input: {
  title: string;
  caption: string;
  mediaUrl: string | null;
  eventId: string | null;
  artist: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const hasEvent = !!input.eventId;
  const hasArtist = !!input.artist?.trim();
  // enforce exactly one tag (matches DB constraint)
  if (hasEvent === hasArtist) {
    throw new Error("Tag exactly one: an event OR an artist");
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    type: "photo",
    media_url: input.mediaUrl,
    title: input.title.trim(),
    caption: input.caption.trim(),
    tagged_event_id: hasEvent ? input.eventId : null,
    tagged_artist: hasArtist ? input.artist!.trim() : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/discover");
  redirect("/discover");
}

// Toggle resonate (like) on a post.
export async function togglePostResonate(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("post_resonates")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_resonates").delete().eq("post_id", postId).eq("user_id", user.id);
    return { resonated: false };
  } else {
    await supabase.from("post_resonates").insert({ post_id: postId, user_id: user.id });
    return { resonated: true };
  }
}
