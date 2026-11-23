"use client";

import { useState } from "react";

export function Gallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="aspect-square rounded-xl bg-surface-2" />;
  const img = images[active] ?? images[0];
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-surface-2">
        <img src={img.url} alt={img.alt ?? title} className="aspect-square w-full object-cover" />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2">
          {images.map((im, i) => (
            <li key={im.url + i}>
              <button type="button" onClick={() => setActive(i)} aria-label={`${title} ${i + 1}`} aria-current={i === active} className={`block overflow-hidden rounded-lg border-2 ${i === active ? "border-text" : "border-transparent"}`}>
                <img src={im.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
