"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  MotionConfig,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/* ============================================================
   /info — final scope:
   1. Fixed glass nav + hero  = v3 draft (typewriter, ticker, glow)
   2. Below the hero          = original v1 implementation restored
      (sticky scroll-telling DISCOVER/CROWD/MATCH, how-it-works stagger,
       why-cards 3D tilt, genre marquee, final CTA, footer)
   3. FAQ (new)               = six Q&As from resonate_info_draft_v2_1.html
   Motion discipline: transform/opacity only. MotionConfig
   reducedMotion="user" + the SSR-safe hook below handle degradation.
   ============================================================ */

const HEADLINE = "find your people before the show.";

/* SSR-safe reduced-motion: false on the server AND the first client render
   (framer's useReducedMotion is true immediately → hydration mismatch),
   then flips in an effect. Only post-mount behavior branches on it. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ============================================================
   1. V3 HERO (keep)
   ============================================================ */
function Hero() {
  const reduced = usePrefersReducedMotion();
  // deterministic 0 on server + first client render; the effect jumps
  // straight to the full headline for reduced-motion users
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduced) {
      setTyped(HEADLINE.length);
      return;
    }
    let i = 0;
    // brief beat before the first character lands
    const start = setTimeout(() => {
      const t = setInterval(() => {
        i += 1;
        setTyped(i);
        if (i >= HEADLINE.length) clearInterval(t);
      }, 52);
    }, 400);
    return () => clearTimeout(start);
  }, [reduced]);

  return (
    <header className="hero">
      {/* Spline slot: the 3D background canvas goes here, INSIDE .hero
          (it has its own overflow:hidden) — never on an ancestor of the
          scroll-telling section, or sticky dies. */}
      <div className="glow" />
      <div className="ticker">— YOU ARE LISTENER #001 —</div>
      <h1 className="h1">
        {/* ghost keeps the final layout so lines don't reflow while typing */}
        <span className="ghost" aria-hidden="true">
          {HEADLINE}
          <span className="cursor" style={{ visibility: "hidden" }} />
        </span>
        <span className="live">
          {HEADLINE.slice(0, typed)}
          <span className="cursor" />
        </span>
      </h1>
      <p className="sub">
        resonate is the social layer for live music — discover shows that match
        your taste, and meet the people who&apos;ll be in the same crowd.
      </p>
      <div className="cta-row">
        <Link href="/login" className="btn">
          GET STARTED
        </Link>
      </div>
      <div className="scrollhint">▼ SCROLL</div>
    </header>
  );
}

/* ============================================================
   2. V1 LOWER HALF (restored)
   ============================================================ */

/* scroll-telling beats — phone screen layer + flanking caption share a range.
   SCREENSHOT SLOT: when real captures arrive, set `img` to "/screens/<file>.png"
   and the dotgrid placeholder is replaced automatically. */
const BEATS: {
  num: string;
  word: string;
  title: string;
  body: string;
  side: "l" | "r";
  img: string | null;
}[] = [
  {
    num: "01 · DISCOVER",
    word: "DISCOVER",
    title: "every show in your city.",
    body: "One feed, ranked by your Spotify taste. No more digging through five apps to find Friday night.",
    side: "l",
    img: null,
  },
  {
    num: "02 · THE CROWD",
    word: "CROWD",
    title: "see who's actually going.",
    body: "Every show has its own crowd — real ticket holders, visible before the night starts.",
    side: "r",
    img: null,
  },
  {
    num: "03 · MATCH",
    word: "MATCH",
    title: "match before the doors open.",
    body: "Swipe inside your show, match with people on the same lineup, arrive with plans.",
    side: "l",
    img: null,
  },
];

const STEPS = [
  {
    num: "01",
    title: "FIND THE SHOW",
    body: "Browse every show in your city, ranked by your Spotify taste.",
  },
  {
    num: "02",
    title: "GET TICKETS · GO",
    body: "Buy tickets in-app. Mark yourself going. See who else will be there.",
  },
  {
    num: "03",
    title: "MATCH YOUR PEOPLE",
    body: "Swipe only within your show. Match with people who bought the same ticket.",
  },
];

const WHYS = [
  {
    ico: "◉",
    title: "REAL TASTE, NOT BIOS",
    body: "Matching runs on your actual Spotify listening — not a self-written profile.",
  },
  {
    ico: "◍",
    title: "EVERYONE'S ACTUALLY GOING",
    body: "You only see people with a ticket to the same night. No ghosts.",
  },
  {
    ico: "◎",
    title: "ANONYMOUS CROWD CHAT",
    body: "Every show has its own room. Ask questions, find the pregame, arrive with people.",
  },
];

const GENRES = [
  "TECHNO", "HOUSE", "INDIE", "HIP-HOP", "TRANCE", "BASS",
  "POP", "JAZZ", "R&B", "METAL", "LATIN", "FOLK",
];

/* ===== shared CTA (final section) ===== */
function Cta({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      style={{ display: "inline-block" }}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <Link href="/login" className="mk-cta">
        {children}
      </Link>
    </motion.div>
  );
}

/* ===== scroll-telling ===== */
function ScreenLayer({
  progress,
  range,
  beat,
}: {
  progress: MotionValue<number>;
  range: [number, number, number, number];
  beat: (typeof BEATS)[number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  return (
    <motion.div className="mk-screen-layer dotgrid" style={{ opacity }}>
      {beat.img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={beat.img}
          alt={beat.word}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <>
          <div className="mk-screen-num">{beat.num}</div>
          <div className="mk-screen-word">{beat.word}</div>
          <div className="mk-screen-note">APP SCREENSHOT SLOT</div>
        </>
      )}
    </motion.div>
  );
}

function Caption({
  progress,
  range,
  beat,
}: {
  progress: MotionValue<number>;
  range: [number, number, number, number];
  beat: (typeof BEATS)[number];
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, [range[0], range[1]], [26, 0]);
  return (
    <motion.div className={`mk-cap mk-cap-${beat.side}`} style={{ opacity, y }}>
      <div className="mk-cap-num">{beat.num}</div>
      <h3 className="mk-cap-title">{beat.title}</h3>
      <p className="mk-cap-body">{beat.body}</p>
    </motion.div>
  );
}

// static fallback: phone + all three captions stacked, no sticky theatre
function StaticBeats() {
  return (
    <section style={{ padding: "100px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
      <div className="mk-phone">
        <div className="mk-phone-notch" />
        <div className="mk-phone-screen">
          <div className="mk-screen-layer dotgrid" style={{ opacity: 1 }}>
            <div className="mk-screen-num">{BEATS[0].num}</div>
            <div className="mk-screen-word">{BEATS[0].word}</div>
            <div className="mk-screen-note">APP SCREENSHOT SLOT</div>
          </div>
        </div>
      </div>
      {BEATS.map((b) => (
        <div key={b.num} style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="mk-cap-num">{b.num}</div>
          <h3 className="mk-cap-title">{b.title}</h3>
          <p className="mk-cap-body">{b.body}</p>
        </div>
      ))}
    </section>
  );
}

// animated variant owns useScroll so its target ref always stays mounted
function AnimatedScrolly() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // phone settles in as the section takes over the viewport
  const scale = useTransform(scrollYProgress, [0, 0.3], [0.95, 1]);
  const rotate = useTransform(scrollYProgress, [0, 0.3], [-3, 0]);

  // beat visibility windows: [fadeInStart, fullyIn, fullyOut, fadeOutEnd]
  const ranges: [number, number, number, number][] = [
    [0, 0.08, 0.3, 0.39],
    [0.3, 0.39, 0.61, 0.7],
    [0.61, 0.7, 0.96, 1],
  ];

  return (
    <section ref={ref} className="mk-scrolly">
      <div className="mk-scrolly-sticky">
        <motion.div className="mk-phone" style={{ scale, rotate }}>
          <div className="mk-phone-notch" />
          <div className="mk-phone-screen">
            {BEATS.map((b, i) => (
              <ScreenLayer key={b.num} progress={scrollYProgress} range={ranges[i]} beat={b} />
            ))}
          </div>
        </motion.div>
        {BEATS.map((b, i) => (
          <Caption key={b.num} progress={scrollYProgress} range={ranges[i]} beat={b} />
        ))}
      </div>
    </section>
  );
}

function ScrollTelling() {
  const reduced = usePrefersReducedMotion();
  return reduced ? <StaticBeats /> : <AnimatedScrolly />;
}

/* ===== HOW IT WORKS ===== */
function HowItWorks() {
  const reduced = usePrefersReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: gridRef,
    offset: ["start 88%", "start 40%"],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="mk-how" id="how">
      <div className="mk-wrap">
        <div className="mk-label">HOW IT WORKS</div>
        <h2 className="mk-sec-title">three steps to the front row.</h2>

        <motion.div
          ref={gridRef}
          className="mk-how-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ show: { transition: { staggerChildren: 0.15 } } }}
        >
          <motion.div className="mk-how-line" style={{ scaleX: reduced ? 1 : lineScale }} />
          {STEPS.map((s) => (
            <motion.div
              key={s.num}
              className="mk-step"
              variants={{
                hidden: { opacity: 0, y: 40 },
                show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
              }}
            >
              <div className="mk-step-num">{s.num}</div>
              <h3 className="mk-step-title">{s.title}</h3>
              <p className="mk-step-body">{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ===== WHY RESONATE — 3D tilt cards + marquee ===== */
const TILT_SPRING = { stiffness: 180, damping: 22 };
const TILT_MAX = 6; // degrees

function TiltCard({ why, index }: { why: (typeof WHYS)[number]; index: number }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), TILT_SPRING);
  const ry = useSpring(useMotionValue(0), TILT_SPRING);
  const gx = useSpring(useMotionValue(0), { stiffness: 260, damping: 30 });
  const gy = useSpring(useMotionValue(0), { stiffness: 260, damping: 30 });
  const glow = useSpring(useMotionValue(0), { stiffness: 200, damping: 30 });

  // desktop pointer only — tilt is off on touch devices per the motion rules
  const canTilt = () =>
    !reduced &&
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!canTilt() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * TILT_MAX * 2);
    rx.set(-py * TILT_MAX * 2);
    gx.set(e.clientX - r.left);
    gy.set(e.clientY - r.top);
    glow.set(1);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
    glow.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className="mk-tilt"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.12 }}
    >
      <motion.div className="mk-tilt-glow" style={{ x: gx, y: gy, opacity: glow }} />
      <div className="mk-tilt-inner">
        <div className="mk-why-ico">{why.ico}</div>
        <h3 className="mk-why-title">{why.title}</h3>
        <p className="mk-why-body">{why.body}</p>
      </div>
    </motion.div>
  );
}

function GenreMarquee() {
  // two identical halves → translateX(-50%) loops seamlessly (CSS, transform-only)
  const half = GENRES.map((g) => (
    <span key={g} className="mk-mq-item">
      {g}
      <span className="sep">·</span>
    </span>
  ));
  return (
    <div className="mk-marquee" aria-hidden="true">
      <div className="mk-marquee-track">
        {half}
        {GENRES.map((g) => (
          <span key={`${g}-2`} className="mk-mq-item">
            {g}
            <span className="sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function WhyResonate() {
  return (
    <section className="mk-why" id="why">
      <div className="mk-wrap">
        <div className="mk-label">WHY RESONATE</div>
        <h2 className="mk-sec-title">built for the crowd, not the feed.</h2>
        <div className="mk-why-grid">
          {WHYS.map((w, i) => (
            <TiltCard key={w.title} why={w} index={i} />
          ))}
        </div>
      </div>
      <GenreMarquee />
    </section>
  );
}

/* ============================================================
   3. FAQ (new) — six Q&As from resonate_info_draft_v2_1.html, 1:1
   ============================================================ */
const FAQS = [
  {
    q: "IS RESONATE A DATING APP?",
    a: "it's for finding your people at a show. you swipe within your own show, match, and meet in the crowd. friends, dates, rave fam — what it becomes is up to you.",
  },
  {
    q: "HOW DOES TASTE MATCHING WORK?",
    a: "connect Spotify or pick your genres — resonate ranks the city's shows by what you actually listen to, and surfaces people whose taste overlaps yours.",
  },
  {
    q: "DO I NEED A TICKET TO MATCH?",
    a: "you swipe within shows you're going to. mark yourself going — or grab the ticket in-app — and the crowd opens up.",
  },
  {
    q: "IS IT ANONYMOUS?",
    a: "in crowd chat you're just Listener #N. your profile only shows in matching — and only to people going to the same show.",
  },
  {
    q: "WHERE DOES IT WORK?",
    a: "los angeles first. every LA show we can track is in. more cities are next.",
  },
  {
    q: "WHAT DOES IT COST?",
    a: "free. join, chat, swipe, match — free.",
  },
];

function Faq() {
  return (
    <section className="section faq" id="faq">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="eyebrow">/ FAQ</div>
        <h2 className="h2">straight answers.</h2>
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <div className="a">{f.a}</div>
          </details>
        ))}
      </motion.div>
    </section>
  );
}

/* ===== final CTA + footer (v1) ===== */
function FinalCta() {
  return (
    <section className="mk-final">
      <div className="mk-glow-c" />
      <motion.h2
        className="mk-final-title"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        your next show is waiting.
      </motion.h2>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
      >
        <Cta>GET STARTED</Cta>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-brand">
          res<span className="o">●</span>nate
        </div>
        <div className="mk-footer-links">
          <a href="mailto:chris@resonateapp.live">chris@resonateapp.live</a>
          {/* Instagram placeholder — swap in the real profile URL when live */}
          <span className="mk-footer-soon" title="Coming soon">
            INSTAGRAM
          </span>
          <Link href="/terms">TERMS</Link>
          <Link href="/privacy">PRIVACY</Link>
        </div>
        <div>LOS ANGELES · © 2026</div>
      </div>
    </footer>
  );
}

export default function InfoLanding() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="info-root">
        <nav className="nav">
          <div className="logo">
            res<span className="odot" />nate
          </div>
          <div className="mid">
            <a href="#how">HOW IT WORKS</a>
            <a href="#why">WHY RESONATE</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link href="/login" className="btn sm">
            GET STARTED
          </Link>
        </nav>

        <Hero />
        <ScrollTelling />
        <HowItWorks />
        <WhyResonate />
        <Faq />
        <FinalCta />
        <Footer />
      </div>
    </MotionConfig>
  );
}
