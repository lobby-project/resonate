import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getProfileData } from "@/lib/profile";
import ProfileView from "../ProfileView";

export default async function UserProfilePage({
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

  // viewing your own id → render the editable self view
  if (id === user.id) {
    const me = await getProfileData(user.id);
    if (!me) redirect("/onboarding");
    return <ProfileView data={me} self={true} />;
  }

  const data = await getProfileData(id);
  if (!data) notFound();

  return <ProfileView data={data} self={false} />;
}
