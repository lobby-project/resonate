import { createClient } from "@/lib/supabase/server";
import PeopleMode from "./PeopleMode";
import type { GoingEvent } from "./actions";
import type { FeedPost } from "./ContentFeed";

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let events: GoingEvent[] = [];
  let posts: FeedPost[] = [];

  if (user) {
    // going events (People mode + tagging context)
    const { data: going } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", user.id);
    const ids = (going ?? []).map((g) => g.event_id);
    if (ids.length) {
      const { data: evs } = await supabase
        .from("events")
        .select("id, artist, genre, cover_url")
        .in("id", ids)
        .order("event_date", { ascending: true });
      events = (evs ?? []).map((e) => ({ id: e.id, artist: e.artist, genre: e.genre, cover_url: e.cover_url }));
    }

    // content feed
    const { data: rawPosts } = await supabase
      .from("posts")
      .select("id, user_id, media_url, title, caption, tagged_event_id, tagged_artist, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    if (rawPosts && rawPosts.length) {
      const postIds = rawPosts.map((p) => p.id);
      const authorIds = [...new Set(rawPosts.map((p) => p.user_id))];
      const eventTagIds = [...new Set(rawPosts.map((p) => p.tagged_event_id).filter(Boolean))] as string[];

      const { data: authors } = await supabase.from("users").select("id, display_name").in("id", authorIds);
      const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

      const eventArtistById = new Map<string, string>();
      if (eventTagIds.length) {
        const { data: evs2 } = await supabase.from("events").select("id, artist").in("id", eventTagIds);
        (evs2 ?? []).forEach((e) => eventArtistById.set(e.id, e.artist));
      }

      // likes (count + which are mine)
      const { data: likeRows } = await supabase
        .from("post_resonates")
        .select("post_id, user_id")
        .in("post_id", postIds);
      const likeCountBy = new Map<string, number>();
      const myLikes = new Set<string>();
      (likeRows ?? []).forEach((r) => {
        likeCountBy.set(r.post_id, (likeCountBy.get(r.post_id) ?? 0) + 1);
        if (r.user_id === user.id) myLikes.add(r.post_id);
      });

      // comment counts
      const { data: commentRows } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);
      const commentCountBy = new Map<string, number>();
      (commentRows ?? []).forEach((c) => commentCountBy.set(c.post_id, (commentCountBy.get(c.post_id) ?? 0) + 1));

      posts = rawPosts.map((p) => ({
        id: p.id,
        author: nameById.get(p.user_id) || "SOMEONE",
        isMine: p.user_id === user.id,
        mediaUrl: p.media_url,
        title: p.title ?? "",
        body: p.caption ?? "",
        tag: p.tagged_event_id ? eventArtistById.get(p.tagged_event_id) || "EVENT" : p.tagged_artist || "",
        tagType: p.tagged_event_id ? "event" : "artist",
        resonated: myLikes.has(p.id),
        likeCount: likeCountBy.get(p.id) ?? 0,
        commentCount: commentCountBy.get(p.id) ?? 0,
      }));
    }
  }

  return <PeopleMode events={events} posts={posts} />;
}
