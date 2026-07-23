"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Maximize2, Play, X } from "lucide-react";
import type { ProductMedia } from "@/lib/sample-data";

export function ProductGallery({ media, productName }: { media: ProductMedia[]; productName: string }) {
  const usableMedia = useMemo(() => media.filter((item) => item.type === "video" || item.src), [media]);
  const [activeId, setActiveId] = useState(usableMedia[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);
  const active = usableMedia.find((item) => item.id === activeId) ?? usableMedia[0];

  useEffect(() => {
    if (!expanded) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  if (!active) return <div className="product-gallery-empty">Product media coming soon.</div>;

  const content = active.type === "image" && active.src ? (
    <Image src={active.src} alt={active.alt} fill priority sizes="(max-width: 900px) 100vw, 50vw" />
  ) : active.type === "video" && active.src ? (
    <video src={active.src} poster={active.poster} controls playsInline aria-label={active.alt} />
  ) : (
    <div className="video-placeholder">
      {active.poster ? <Image src={active.poster} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" /> : null}
      <span><Play size={28} fill="currentColor" /> Product video</span>
      <small>Connect Cloudflare Stream to play uploaded video.</small>
    </div>
  );

  return (
    <div className="product-gallery">
      <button className="gallery-main" type="button" onClick={() => setExpanded(true)} aria-label={`Open ${productName} media in a larger view`}>
        {content}
        <span className="gallery-expand"><Maximize2 size={17} /> Enlarge</span>
      </button>
      <div className="gallery-thumbnails" aria-label="Product media">
        {usableMedia.map((item, index) => (
          <button
            className={item.id === active.id ? "active" : ""}
            type="button"
            key={item.id}
            onClick={() => setActiveId(item.id)}
            aria-label={`View ${item.type} ${index + 1}`}
          >
            {item.type === "image" && item.src ? (
              <Image src={item.src} alt="" fill sizes="88px" />
            ) : item.poster ? (
              <><Image src={item.poster} alt="" fill sizes="88px" /><span className="thumbnail-play"><Play size={15} fill="currentColor" /></span></>
            ) : <Play size={20} />}
          </button>
        ))}
      </div>
      {expanded ? (
        <div className="gallery-modal" role="dialog" aria-modal="true" aria-label={`${productName} media viewer`} onClick={() => setExpanded(false)}>
          <button className="gallery-close" type="button" onClick={() => setExpanded(false)} aria-label="Close enlarged media"><X /></button>
          <div className="gallery-modal-content" onClick={(event) => event.stopPropagation()}>{content}</div>
        </div>
      ) : null}
    </div>
  );
}
