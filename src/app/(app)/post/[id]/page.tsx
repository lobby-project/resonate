import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import PostDetail, { type PostDetailData } from "./PostDetail";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("posts")
    .select("id, user_id, media_url, title, caption, tagged_event_id, tagged_artist, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!post) notFound();

  // author
  const { data: author } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", post.user_id)
    .maybeSingle();

  // event tag artist name
  let tag = post.tagged_artist || "";
  if (post.tagged_event_id) {
    const { data: ev } = await supabase
      .from("events")
      .select("artist")
      .eq("id", post.tagged_event_id)
      .maybeSingle();
    tag = ev?.artist || "EVENT";
  }

  // likes
  const { data: likeRows } = await supabase
    .from("post_resonates")
    .select("user_id")
    .eq("post_id", id);
  const likeCount = likeRows?.length ?? 0;
  const resonated = (likeRows ?? []).some((r) => r.user_id === user.id);

  // comments + commenter names
  const { data: rawComments } = await supabase
    .from("post_comments")
    .select("id, user_id, text, created_at")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  const commenterIds = [...new Set((rawComments ?? []).map((c) => c.user_id))];
  const nameById = new Map<string, string>();
  if (commenterIds.length) {
    const { data: us } = await supabase.from("users").select("id, display_name").in("id", commenterIds);
    (us ?? []).forEach((u) => nameById.set(u.id, u.display_name));
  }

  const data: PostDetailData = {
    id: post.id,
    author: author?.display_name || "SOMEONE",
    isMine: post.user_id === user.id,
    mediaUrl: post.media_url,
    title: post.title ?? "",
    body: post.caption ?? "",
    tag,
    tagType: post.tagged_event_id ? "event" : "artist",
    likeCount,
    resonated,
    comments: (rawComments ?? []).map((c) => ({
      id: c.id,
      author: nameById.get(c.user_id) || "SOMEONE",
      isMine: c.user_id === user.id,
      text: c.text,
    })),
  };

  return <PostDetail data={data} />;
}
