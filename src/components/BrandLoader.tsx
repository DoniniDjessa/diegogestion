import Image from "next/image";

/** Écran de chargement Diego : logo + ligne animée. */
export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-surface-muted">
      <Image
        src="/diego.png"
        alt="Chez Diego"
        width={160}
        height={80}
        priority
        className="h-auto w-36 object-contain"
      />
      <div className="relative h-[3px] w-44 overflow-hidden rounded-full bg-line">
        <span className="absolute inset-y-0 w-1/3 animate-loader-line rounded-full bg-brand-500" />
      </div>
      {label && <p className="text-2xs text-ink-faint">{label}</p>}
    </div>
  );
}
