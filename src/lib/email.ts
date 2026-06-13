// Resend 确认邮件(直接 fetch API,不引 SDK)。
// 需要环境变量:RESEND_API_KEY;RESEND_FROM 可选,默认用 Resend 的测试发件地址
// (测试地址只能发给你自己的注册邮箱,正式发件要在 Resend 验证域名后改 RESEND_FROM)。

type TicketEmailInput = {
  to: string;
  eventTitle: string;
  venue: string | null;
  eventDate: string | null; // ISO
  codes: string[];
  ticketNote: string | null;
  siteUrl: string;
};

export async function sendTicketEmail(input: TicketEmailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY 未配置,跳过确认邮件");
    return;
  }
  const from = process.env.RESEND_FROM || "Resonate <onboarding@resend.dev>";

  const dateLine = input.eventDate
    ? new Date(input.eventDate).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Date TBD";

  const codesHtml = input.codes
    .map(
      (c) =>
        `<div style="font-family:monospace;font-size:18px;letter-spacing:2px;background:#0a0a0a;color:#39FF14;border:1px solid #262626;border-radius:8px;padding:14px 18px;margin:8px 0;text-align:center;">${c}</div>`
    )
    .join("");

  const html = `
  <div style="background:#000;color:#ddd;font-family:monospace;padding:32px 24px;max-width:520px;margin:0 auto;">
    <div style="font-size:20px;color:#fff;margin-bottom:4px;">res<span style="color:#39FF14;">&#9673;</span>nate</div>
    <div style="font-size:10px;color:#555;letter-spacing:3px;margin-bottom:28px;">YOUR TICKETS</div>
    <div style="font-size:17px;color:#fff;margin-bottom:6px;">${input.eventTitle}</div>
    <div style="font-size:12px;color:#888;margin-bottom:20px;">${dateLine}${input.venue ? " · " + input.venue : ""}</div>
    ${codesHtml}
    <div style="font-size:12px;color:#888;line-height:1.8;margin-top:20px;">
      Show the QR code in the app at the door — open <a href="${input.siteUrl}/tickets" style="color:#39FF14;">MY TICKETS</a>.
    </div>
    ${input.ticketNote ? `<div style="font-size:11px;color:#666;line-height:1.7;margin-top:18px;border-top:1px dashed #262626;padding-top:14px;">${input.ticketNote}</div>` : ""}
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Your tickets — ${input.eventTitle}`,
        html,
      }),
    });
    if (!res.ok) console.error("[email] Resend 返回", res.status, await res.text());
  } catch (e) {
    console.error("[email] 发送失败(不影响出票):", e);
  }
}
