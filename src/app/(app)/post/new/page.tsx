import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreatePost, { type GoingEventOption } from "./CreatePost";

export default async function NewPostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // events the user is going to → taggable
  const { data: going } = await supabase
    .from("event_attendees")
    .select("event_id")
    .eq("user_id", user.id);
  const ids = (going ?? []).map((g) => g.event_id);

  let events: GoingEventOption[] = [];
  if (ids.length) {
    const { data: evs } = await supabase
      .from("events")
      .select("id, artist")
      .in("id", ids)
      .order("event_date", { ascending: true });
    events = (evs ?? []).map((e) => ({ id: e.id, artist: e.artist }));
  }

  return <CreatePost userId={user.id} events={events} />;
}
