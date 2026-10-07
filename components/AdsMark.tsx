"use client";
// Logo Google Ads officiel (public/google-ads.svg) ; pastille neutre si le fichier est absent.
import { useState } from "react";

export default function AdsMark({ size = 16 }: { size?: number }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className="cs-mark-fallback" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/google-ads.svg" alt="" width={size} height={size} style={{ width: size, height: size, flexShrink: 0 }} onError={() => setOk(false)} />;
}
