/**
 * Compresse une image côté navigateur avant l'envoi vers Supabase Storage :
 * redimensionne à 1200px max et convertit en WebP (qualité 0.8).
 * Retourne le fichier original si la compression échoue ou ne réduit pas la taille.
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<File> {
  // Les GIF (animations) et fichiers non-image sont laissés tels quels.
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.\w+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
