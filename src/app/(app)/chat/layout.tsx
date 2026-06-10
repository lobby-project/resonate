import { createClient } from "@/lib/supabase/server";
import ChatList, { type EventRoom, type PrivateThread } from "./ChatList";
import ChatShell from "./ChatShell";

// 双栏聊天的骨架:列表数据在 layout 获取(对话间切换时列表不重载),
// 左栏 = ChatList,右栏 = {children}(对话 或 /chat 的空态)。
// 手机端仍是"列表页 ⇄ 全屏对话"的跳页行为,由 ChatShell + CSS 控制。
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rooms: EventRoom[] = [];
  let threads: PrivateThread[] = [];

  if (user) {
    // event rooms = events the user is going to
    const { data: going } = await supabase
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", user.id);

    const eventIds = (going ?? []).map((g) => g.event_id);
    if (eventIds.length) {
      const { data: events } = await supabase
        .from("events")
        .select("id, artist, genre, cover_url")
        .in("id", eventIds);
      rooms = (events ?? []).map((e) => ({
        id: e.id,
        artist: e.artist,
        genre: e.genre,
        cover_url: e.cover_url ?? null,
      }));
    }

    // private threads = matches the user is part of
    const { data: matches } = await supabase
      .from("matches")
      .select("id, user_a, user_b, event_id")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (matches && matches.length) {
      const otherIds = matches.map((m) =>
        m.user_a === user.id ? m.user_b : m.user_a
      );
      const eventIds2 = matches.map((m) => m.event_id);
      const { data: others } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", otherIds);
      const { data: evs } = await supabase
        .from("events")
        .select("id, artist")
        .in("id", eventIds2);

      const nameById = new Map((others ?? []).map((o) => [o.id, o.display_name]));
      const artistById = new Map((evs ?? []).map((e) => [e.id, e.artist]));

      threads = matches.map((m) => {
        const otherId = m.user_a === user.id ? m.user_b : m.user_a;
        return {
          matchId: m.id,
          name: nameById.get(otherId) || "MATCH",
          eventArtist: artistById.get(m.event_id) ?? null,
        };
      });
    }
  }

  return (
    <ChatShell list={<ChatList rooms={rooms} threads={threads} />}>
      {children}
    </ChatShell>
  );
}
