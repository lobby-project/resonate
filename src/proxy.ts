import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match every request EXCEPT:
    //   api                              — API routes (self-authenticate inside route handlers)
    //   _next/static, _next/image        — built bundles + image optimizer
    //   __nextjs_font                    — Next 16 self-hosted font endpoint
    //   favicon.ico                      — favicon
    //   *.{svg,png,jpg,jpeg,gif,webp,
    //      woff,woff2,ttf,otf}           — static asset extensions (incl. fonts)
    "/((?!api|_next/static|_next/image|__nextjs_font|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};
