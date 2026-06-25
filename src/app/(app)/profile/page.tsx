import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getProfileData } from "@/lib/profile";
import ProfileView from "./ProfileView";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getProfileData(user.id);
  if (!data) redirect("/onboarding");

  return <ProfileView data={data} self={true} />;
}
