import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventChat, { type EventMsg } from "./EventChat";

export default async function EventChatPage({
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

  // must be attending to enter the chat
  const { data: att } = await supabase
    .from("event_attendees")
    .select("anon_num")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!att) {
    // not going → bounce to the event detail so they can mark going
    redirect(`/events/${id}`);
  }

  const { data: event } = await supabase
    .from("events")
    .select("artist")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const { data: msgs } = await supabase
    .from("event_messages")
    .select("id, anon_num, text, user_id, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <EventChat
      eventId={id}
      artist={event.artist}
      myUserId={user.id}
      myAnonNum={att.anon_num ?? 0}
      initialMessages={(msgs ?? []) as EventMsg[]}
    />
  );
}
