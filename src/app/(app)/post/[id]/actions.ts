"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Add a comment to a post.
export async function addComment(postId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const t = text.trim();
  if (!t) throw new Error("Empty comment");

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.id, text: t })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/post/${postId}`);
  return { id: data.id as string, createdAt: data.created_at as string };
}

// Delete own comment.
export async function deleteComment(commentId: string, postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("post_comments").delete().eq("id", commentId).eq("user_id", user.id);
  revalidatePath(`/post/${postId}`);
}
