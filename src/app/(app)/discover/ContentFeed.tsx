"use client";

import { useRouter } from "next/navigation";
import TextCard from "./TextCard";

export type FeedPost = {
  id: string;
  author: string;
  isMine: boolean;
  mediaUrl: string | null;
  title: string;
  body: string;
  tag: string;
  tagType: "event" | "artist";
  resonated: boolean;
  likeCount: number;
  commentCount: number;
};

function FeedCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  return (
    <div
      className="feed-card"
      onClick={() => router.push(`/post/${post.id}`)}
      style={{
        breakInside: "avoid",
        marginBottom: 12,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* visual: photo OR text card */}
      {post.mediaUrl ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.mediaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <TextCard seed={post.id} title={post.title} body={post.body} variant="thumb" />
      )}

      {/* meta */}
      <div style={{ padding: "10px 11px 12px" }}>
        {post.mediaUrl && post.title && (
          <div style={{ fontFamily: "var(--ndot)", fontSize: 13, color: "#fff", lineHeight: 1.3, marginBottom: 6 }}>
            {post.title}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: ".06em", color: "var(--gray)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(post.author || "?").toUpperCase()}
          </span>
          <span className="mono" style={{ fontSize: 9, color: post.resonated ? "var(--green)" : "var(--gray3)", whiteSpace: "nowrap" }}>
            {post.resonated ? "✦" : "○"} {post.likeCount}
          </span>
        </div>
        <div className="mono" style={{ marginTop: 6, fontSize: 8, letterSpacing: ".05em", color: post.tagType === "event" ? "var(--green)" : "#b98cff" }}>
          {post.tagType === "event" ? "◆" : "♫"} {post.tag.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export default function ContentFeed({ posts }: { posts: FeedPost[] }) {
  const router = useRouter();

  if (!posts.length) {
    return (
      <div className="empty" style={{ marginTop: 40 }}>
        <span className="big">NO POSTS YET</span>
        BE THE FIRST · TAP + TO POST ●
        <button className="btn-primary" style={{ marginTop: 18 }} onClick={() => router.push("/post/new")}>
          CREATE POST →
        </button>
      </div>
    );
  }

  // 2-column masonry via CSS columns
  return (
    <div className="feed-masonry">
      {posts.map((p) => (
        <FeedCard key={p.id} post={p} />
      ))}
    </div>
  );
}
