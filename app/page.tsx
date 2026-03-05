"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isStandaloneNow() {
  const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithStandalone) : null;
  const iosStandalone = !!nav?.standalone;

  const mql =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;

  return iosStandalone || mql;
}

function isPhoneNow() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPhone = /iPhone|iPod/i.test(ua);
  const androidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  return iPhone || androidPhone;
}

export default function StartPage() {
  const router = useRouter();

  // ✅ no setState-in-effect: initialize from runtime once
  const [phone] = useState<boolean>(() => isPhoneNow());
  const [standalone] = useState<boolean>(() => isStandaloneNow());

  // ✅ effect only performs navigation (external side-effect)
  useEffect(() => {
    if (phone && standalone) router.replace("/app");
  }, [phone, standalone, router]);

  const topPad = useMemo(() => "calc(env(safe-area-inset-top, 0px) + 34px)", []);

  if (!phone) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#e3e5e4",
          color: "#48494b",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "min(520px, 100%)" }}>
          <div style={{ fontSize: 18, letterSpacing: 0.6, opacity: 0.9 }}>
            G-Normies App Experience
          </div>
          <div style={{ height: 14 }} />
          <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
            This start page is phone-only.
            <br />
            Open this link on an iPhone (Safari) or Android phone to install and run the web app.
          </div>
          <div style={{ height: 18 }} />
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Once installed, it launches full-screen from your Home Screen.
          </div>

          <div style={{ height: 18 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              href="https://glitch-normies.vercel.app/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#48494b", textDecoration: "none", opacity: 0.85, fontSize: 13 }}
            >
              Get a G-Normie
            </a>
            <a
              href="https://x.com/0xfilter8"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#48494b", textDecoration: "none", opacity: 0.7, fontSize: 13 }}
            >
              by 0xfilter8
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#e3e5e4",
        color: "#48494b",
        overflow: "hidden",
        paddingTop: topPad,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 18, letterSpacing: 0.6, opacity: 0.9 }}>
        G-Normies App Experience
      </div>

      <div style={{ height: 14 }} />

      <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
        Save this page to your Home Screen for the full-screen experience.
      </div>

      <div style={{ height: 14 }} />

      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8, opacity: 0.85 }}>
        <li>
          Tap the <b>Share</b> icon in Safari
        </li>
        <li>
          Select <b>Add to Home Screen</b>
        </li>
        <li>
          Open <b>G-Normies</b> from your Home Screen
        </li>
      </ol>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(320px, 100%)" }}>
          <Link
            href="/app"
            style={{
              textDecoration: "none",
              border: "1px solid #48494b",
              padding: "14px 14px",
              color: "#e3e5e4",
              background: "#48494b",
              fontSize: 14,
              opacity: 0.95,
              textAlign: "center",
              userSelect: "none",
            }}
          >
            Open
          </Link>

          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              border: "1px solid rgba(72,73,75,0.55)",
              padding: "14px 14px",
              color: "#48494b",
              background: "transparent",
              fontSize: 14,
              opacity: 0.9,
              cursor: "pointer",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            I installed it
          </button>

          {/* simple + clean links (not poky) */}
          <div style={{ height: 6 }} />

          <a
            href="https://glitch-normies.vercel.app/"
            target="_blank"
            rel="noreferrer"
            style={{
              textAlign: "center",
              fontSize: 12,
              opacity: 0.7,
              color: "#48494b",
              textDecoration: "none",
            }}
          >
            Get a G-Normie
          </a>

          <a
            href="https://x.com/0xfilter8"
            target="_blank"
            rel="noreferrer"
            style={{
              textAlign: "center",
              fontSize: 12,
              opacity: 0.6,
              color: "#48494b",
              textDecoration: "none",
            }}
          >
            by 0xfilter8
          </a>

          {standalone ? (
            <div style={{ fontSize: 12, opacity: 0.55, textAlign: "center" }}>Launching…</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}