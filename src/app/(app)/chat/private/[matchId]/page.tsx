import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import PrivateChat, { type PrivateMsg } from "./PrivateChat";

export default async function PrivateChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // load match; RLS ensures only participants can read it
  const { data: match } = await supabase
    .from("matches")
    .select("user_a, user_b")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) notFound();
  if (match.user_a !== user.id && match.user_b !== user.id) notFound();

  const otherId = match.user_a === user.id ? match.user_b : match.user_a;
  const { data: other } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", otherId)
    .single();

  const { data: msgs } = await supabase
    .from("private_messages")
    .select("id, sender_id, text, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <PrivateChat
      matchId={matchId}
      otherName={other?.display_name || "MATCH"}
      otherId={otherId}
      myUserId={user.id}
      initialMessages={(msgs ?? []) as PrivateMsg[]}
    />
  );
}
