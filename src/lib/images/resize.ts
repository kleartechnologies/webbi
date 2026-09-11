/** Browser-side image optimisation before upload: max 1600px edge, WebP ~82%. */
export interface OptimizedImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  extension: string;
}

export async function optimizeImage(file: File, maxEdge = 1600, quality = 0.82): Promise<OptimizedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo (JPG, PNG, HEIC or WebP).");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("This photo couldn't be read. Try a JPG or PNG.");
  });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process photos.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (blob && blob.type === "image/webp") return { blob, width, height, contentType: "image/webp", extension: "webp" };
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!jpeg) throw new Error("This photo couldn't be processed.");
  return { blob: jpeg, width, height, contentType: "image/jpeg", extension: "jpg" };
}
