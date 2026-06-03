"use client";

// Renders a pure-text post as an IG-story-style card: a deterministic
// gradient background with the title centered. Used in feed thumbnails and
// the post detail view when a post has no photo.

const GRADIENTS = [
  ["#1f7a0e", "#39FF14"],
  ["#3a1a6e", "#b98cff"],
  ["#0e2a5e", "#3c8cff"],
  ["#0e4a4a", "#28dcdc"],
  ["#5e3a0e", "#ffb428"],
  ["#5e0e1a", "#ff5050"],
  ["#2a2a2a", "#888888"],
];

function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length] as [string, string];
}

export default function TextCard({
  seed,
  title,
  body,
  variant = "thumb",
}: {
  seed: string;
  title: string;
  body?: string;
  variant?: "thumb" | "full";
}) {
  const [a, b] = gradientFor(seed);
  const full = variant === "full";
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: full ? "4 / 5" : "3 / 4",
        borderRadius: full ? 12 : 10,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${a} 0%, #000 55%, ${b} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: full ? "32px 24px" : "18px 14px",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--ndot)",
          color: "#fff",
          fontSize: full ? 26 : 15,
          lineHeight: 1.25,
          letterSpacing: ".01em",
          textShadow: "0 2px 12px rgba(0,0,0,.5)",
          display: "-webkit-box",
          WebkitLineClamp: full ? 6 : 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title || (body ?? "").slice(0, 80) || "—"}
      </span>
      {full && body && (
        <span
          style={{
            fontFamily: "var(--mono)",
            color: "rgba(255,255,255,.85)",
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: 16,
            maxWidth: 320,
          }}
        >
          {body}
        </span>
      )}
    </div>
  );
}
