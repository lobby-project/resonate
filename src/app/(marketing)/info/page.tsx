import { redirect } from "next/navigation";

// The landing moved to the root route (/). /info stays alive as a redirect
// because the link may already be in the wild. Still listed in the
// middleware's public routes so logged-out visitors reach this redirect.
export default function InfoPage() {
  redirect("/");
}
