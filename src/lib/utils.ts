import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalisasi URL gambar Google Drive agar bisa ditampilkan langsung di <img>/CSS,
 * terutama pada WebView mobile (Capacitor APK) yang sering memblokir redirect
 * dari drive.google.com -> lh3.googleusercontent.com.
 */
export function normalizeImageUrl(url: string, defaultSize: string = "w1200"): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      let id = u.searchParams.get("id");
      let size = u.searchParams.get("sz") || defaultSize;
      if (!id) {
        const m = u.pathname.match(/\/file\/d\/([^/]+)/);
        if (m) id = m[1];
      }
      if (id) {
        if (!/^[wsh]\d+$/.test(size)) size = defaultSize;
        return `https://lh3.googleusercontent.com/d/${id}=${size}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}
