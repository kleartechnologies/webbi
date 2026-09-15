import { ApiError } from "@/lib/api/client";
import { appCheckHeaders } from "@/lib/firebase/appCheck";
import { getClientAuth } from "@/lib/firebase/client";
import type { SiteImage } from "@/lib/site/schema";
import { isUploadType, MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE, UNSUPPORTED_MESSAGE } from "./limits";
import { optimizeImage } from "./resize";

/**
 * Resizes a photo in the browser, then sends it to POST /api/sites/images,
 * which checks it and stores it in the website's folder. The checks here only
 * give a quick message; the server repeats them on the bytes it receives.
 *
 * There is no browser delete: files a website stops using are cleared by the
 * server (src/lib/images/storage.ts), after the saved website no longer
 * points at them.
 */
export async function uploadSiteImage(
  siteId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<SiteImage> {
  if (!isUploadType(file.type)) throw new Error(UNSUPPORTED_MESSAGE);
  const optimized = await optimizeImage(file);
  if (optimized.blob.size > MAX_UPLOAD_BYTES) throw new Error(TOO_LARGE_MESSAGE);
  const user = getClientAuth().currentUser;
  if (!user) throw new ApiError("unauthenticated", "Sign in to continue.", 401);
  const [token, appCheck] = await Promise.all([user.getIdToken(), appCheckHeaders()]);

  // XMLHttpRequest rather than fetch: it reports upload progress for the progress bar.
  return new Promise<SiteImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/sites/images?siteId=${encodeURIComponent(siteId)}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("content-type", optimized.contentType);
    for (const [name, value] of Object.entries(appCheck)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => onProgress?.(event.lengthComputable && event.total ? event.loaded / event.total : 0);
    xhr.onerror = () => reject(new ApiError("network", "No connection. Check your internet and try again.", 0));
    xhr.onload = () => {
      let data: Partial<SiteImage> & { error?: { code?: string; message?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON (a proxy error page): fall through to the generic message.
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof data.url === "string") {
        resolve({ url: data.url, path: data.path, width: data.width, height: data.height });
        return;
      }
      reject(new ApiError(data.error?.code ?? "unknown", data.error?.message ?? "That image couldn't be uploaded. Please try again.", xhr.status));
    };
    xhr.send(optimized.blob);
  });
}
