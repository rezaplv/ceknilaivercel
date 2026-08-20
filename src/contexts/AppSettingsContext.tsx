import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { fetchSettings } from "@/lib/api";
import { normalizeImageUrl } from "@/lib/utils";

interface AppSettings {
  semester: string;
  tahunAjaran: string;
  appName: string;
  subDesc: string;
  logoUrl: string;
  bgLoginUrl: string;
  copyrightText: string;
  copyrightEnabled: boolean;
  loaded: boolean;
  setSemester: (v: string) => void;
  setTahunAjaran: (v: string) => void;
  setAppName: (v: string) => void;
  setSubDesc: (v: string) => void;
  setLogoUrl: (v: string) => void;
  setBgLoginUrl: (v: string) => void;
  setCopyrightText: (v: string) => void;
  setCopyrightEnabled: (v: boolean) => void;
  reload: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [semester, setSemester] = useState("Genap");
  const [tahunAjaran, setTahunAjaran] = useState("2025/2026");
  const [appName, setAppName] = useState("Sistem Nilai");
  const [subDesc, setSubDesc] = useState("Manajemen Penilaian Sekolah");
  const [logoUrl, setLogoUrl] = useState("");
  const [bgLoginUrl, setBgLoginUrl] = useState("");
  const [copyrightText, setCopyrightText] = useState("Palevi Official");
  const [copyrightEnabled, setCopyrightEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadSettings = async () => {
    const s = await fetchSettings();
    if (s.semester) setSemester(s.semester);
    if (s.tahun_ajaran) setTahunAjaran(s.tahun_ajaran);
    if (s.app_name) setAppName(s.app_name);
    if (s.sub_desc) setSubDesc(s.sub_desc);
    if (s.logo_url !== undefined) setLogoUrl(normalizeImageUrl(s.logo_url));
    if (s.bg_login_url !== undefined) setBgLoginUrl(normalizeImageUrl(s.bg_login_url));
    if (s.copyright_text !== undefined) setCopyrightText(s.copyright_text || "Palevi Official");
    if (s.copyright_enabled !== undefined) setCopyrightEnabled(s.copyright_enabled !== "false");
    setLoaded(true);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Sinkronkan favicon dengan logo aplikasi (re-render ke canvas agar tajam di ukuran kecil)
  useEffect(() => {
    if (!logoUrl) return;
    const head = document.head;

    const setFavicon = (href: string, sizes?: string) => {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      if (sizes) link.setAttribute("sizes", sizes);
      link.href = href;
      head.appendChild(link);
    };

    const renderToCanvas = (img: HTMLImageElement, size: number): string => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return logoUrl;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Latar transparan — tidak ada lingkaran/kotak putih
      ctx.clearRect(0, 0, size, size);
      // Logo memenuhi area (padding minimum) agar tampak jelas di tab kecil
      const pad = Math.max(1, Math.round(size * 0.02));
      const target = size - pad * 2;
      const ratio = Math.min(target / img.width, target / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL("image/png");
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Bersihkan icon lama setelah berhasil load
      head.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((el) => el.parentNode?.removeChild(el));
      try {
        setFavicon(renderToCanvas(img, 32), "32x32");
        setFavicon(renderToCanvas(img, 64), "64x64");
        setFavicon(renderToCanvas(img, 192), "192x192");
        const apple = document.createElement("link");
        apple.rel = "apple-touch-icon";
        apple.href = renderToCanvas(img, 180);
        head.appendChild(apple);
      } catch {
        // Fallback bila CORS memblokir canvas
        setFavicon(logoUrl);
      }
    };
    img.onerror = () => {
      head.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((el) => el.parentNode?.removeChild(el));
      setFavicon(logoUrl);
    };
    img.src = logoUrl;
  }, [logoUrl]);

  return (
    <AppSettingsContext.Provider value={{
      semester, tahunAjaran, appName, subDesc, logoUrl, bgLoginUrl, copyrightText, copyrightEnabled, loaded,
      setSemester, setTahunAjaran, setAppName, setSubDesc, setLogoUrl, setBgLoginUrl, setCopyrightText, setCopyrightEnabled,
      reload: loadSettings,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}
