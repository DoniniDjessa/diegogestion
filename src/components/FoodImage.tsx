"use client";

import { resolveFoodImage } from "@/lib/media";

type FoodImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function FoodImage({ src, alt, className = "" }: FoodImageProps) {
  return (
    // Local /public placeholder + optional Supabase Storage URLs
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveFoodImage(src)}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
