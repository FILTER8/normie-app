"use client";

import { useState } from "react";
import NormieViewer from "../ui/NormieViewer";

function isPhoneNow() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const iPhone = /iPhone|iPod/i.test(ua);
  const androidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  return iPhone || androidPhone;
}

export default function AppPage() {
  const [ok] = useState<boolean>(() => isPhoneNow());

  if (!ok) {
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
        <div style={{ width: "min(520px, 100%)", fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
          This view is phone-only. Open on an iPhone or Android phone.
        </div>
      </main>
    );
  }

  return <NormieViewer />;
}