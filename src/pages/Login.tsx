import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizeImageUrl } from "@/lib/utils";
import { GraduationCap, Eye, EyeOff, Loader2, LogIn, Heart, Info } from "lucide-react";
import loginBgDefault from "@/assets/login-bg.jpg";

export default function Login() {
  const { appName, subDesc, logoUrl, bgLoginUrl, copyrightText, copyrightEnabled, loaded: settingsLoaded } = useAppSettings();
  usePageTitle("Login");
  const { login } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [username, setUsername] = useState<string>(() => {
    try { return localStorage.getItem("remembered_username") || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      // Tercentang bila user pernah memilih "Ingat saya" (flag aktif ATAU username tersimpan)
      return localStorage.getItem("remember_me") === "1"
        || !!localStorage.getItem("remembered_username");
    } catch { return false; }
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username dan password harus diisi");
      return;
    }
    setLoading(true);
    setError("");
    const success = await login(username, password, rememberMe);
    setLoading(false);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Username atau password salah");
    }
  };

  // Bangun srcset responsif — browser pilih ukuran sesuai lebar layar & DPR
  const { bgSrc, bgSrcSet } = useMemo(() => {
    const raw = bgLoginUrl || loginBgDefault;
    // Untuk Google Drive: hasilkan beberapa ukuran (w480/w800/w1200/w1600)
    const widths = [480, 800, 1200, 1600];
    const variants = widths
      .map((w) => {
        const url = normalizeImageUrl(raw, `w${w}`);
        // Jika tidak diubah (bukan Drive), srcset tidak relevan
        return url === raw ? null : `${url} ${w}w`;
      })
      .filter(Boolean) as string[];

    return {
      bgSrc: normalizeImageUrl(raw, isMobile ? "w800" : "w1200"),
      bgSrcSet: variants.length > 0 ? variants.join(", ") : undefined,
    };
  }, [bgLoginUrl, isMobile]);

  // Loading gate — tampilkan loader sampai setting, background, logo, dan font benar-benar siap
  const [bgLoaded, setBgLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBgLoaded(false);
    setLogoLoaded(!logoUrl);
    setFontsLoaded(false);

    const f = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (f?.ready) {
      f.ready.then(() => { if (!cancelled) setFontsLoaded(true); });
    } else {
      setFontsLoaded(true);
    }
    // Preload background
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { if (!cancelled) setBgLoaded(true); };
    img.onerror = () => { if (!cancelled) setBgLoaded(true); };
    if (bgSrcSet) (img as HTMLImageElement & { srcset: string }).srcset = bgSrcSet;
    img.src = bgSrc;

    if (logoUrl) {
      const logo = new Image();
      logo.referrerPolicy = "no-referrer";
      logo.onload = () => { if (!cancelled) setLogoLoaded(true); };
      logo.onerror = () => { if (!cancelled) setLogoLoaded(true); };
      logo.src = logoUrl;
    }

    // Safety fallback — paksa siap setelah 4 detik agar tidak nyangkut
    const t = window.setTimeout(() => {
      if (!cancelled) { setBgLoaded(true); setLogoLoaded(true); setFontsLoaded(true); }
    }, 4000);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [bgSrc, bgSrcSet, logoUrl]);

  const ready = settingsLoaded && bgLoaded && logoLoaded && fontsLoaded;

  return (
    <main className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-background py-[max(1rem,env(safe-area-inset-top))]" role="main" aria-label="Halaman Login">
      {/* Background Image — pakai <img> agar bisa srcset + lazy/decoding hint */}
      <img
        src={bgSrc}
        srcSet={bgSrcSet}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[hsl(0_0%_0%/0.5)]" />

      {/* Loader fullscreen — menutup semua sampai aset benar-benar siap */}
      {!ready && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background"
          aria-live="polite"
        >
          <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
          <p className="mt-3 text-sm text-foreground/80">Memuat halaman login…</p>
        </div>
      )}




      {/* Login Card — disembunyikan sampai semua aset siap */}
      {ready && <div className="relative z-10 isolate w-full max-w-[min(28rem,calc(100vw-1.5rem))] mx-3 sm:mx-4">
        <div className="login-card-clean rounded-2xl p-5 sm:p-8 md:p-10 pt-7 sm:pt-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            {logoUrl ? (
              <div className="mb-3 sm:mb-4 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-card/90 border-2 border-white/40 shadow-2xl flex items-center justify-center p-3">
                <img src={logoUrl} alt={`Logo ${appName || 'Sistem Nilai'}`} referrerPolicy="no-referrer" loading="eager" onLoad={() => setLogoLoaded(true)} onError={() => setLogoLoaded(true)} className="w-full h-full object-contain drop-shadow-lg" />
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary flex items-center justify-center mb-3 sm:mb-4 shadow-lg shadow-primary/40 ring-2 ring-white/30">
                <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-white font-display text-center text-shadow-strong">{appName || "Sistem Nilai"}</h1>
            <p className="text-xs sm:text-sm text-white/85 mt-1 text-center text-shadow-soft">{subDesc || "Manajemen Penilaian Sekolah"}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-label="Form Login">
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-white/90 mb-1.5 uppercase tracking-wider text-shadow-soft">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background/95 border border-white/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors text-sm"
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              {/* Petunjuk: deteksi karakter selain huruf/angka pada username */}
              {(() => {
                const invalid = username.match(/[^a-zA-Z0-9]/g);
                if (!invalid || invalid.length === 0) return null;
                const unique = Array.from(new Set(invalid));
                const cleaned = username.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                return (
                  <div role="status" className="mt-2 flex items-start gap-2 text-xs text-white bg-amber-500/85 border border-amber-300/50 rounded-lg px-3 py-2 text-shadow-soft">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="leading-relaxed">
                      Username mengandung karakter <span className="font-semibold">{unique.map(c => c === " " ? "spasi" : `"${c}"`).join(", ")}</span>.
                      Mohon gunakan huruf kecil dan angka saja.
                      {cleaned && <> Contoh: <span className="font-mono font-semibold">{cleaned}</span></>}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-white/90 mb-1.5 uppercase tracking-wider text-shadow-soft">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background/95 border border-white/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors text-sm pr-12 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                  style={{ WebkitTextSecurity: showPassword ? 'none' : undefined } as React.CSSProperties}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode={showPassword ? "text" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              {/* Petunjuk: deteksi karakter selain huruf/angka pada password */}
              {(() => {
                const invalid = password.match(/[^a-zA-Z0-9]/g);
                if (!invalid || invalid.length === 0) return null;
                const unique = Array.from(new Set(invalid));
                const cleaned = password.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                return (
                  <div role="status" className="mt-2 flex items-start gap-2 text-xs text-white bg-amber-500/85 border border-amber-300/50 rounded-lg px-3 py-2 text-shadow-soft">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="leading-relaxed">
                      Password terdeteksi mengandung karakter <span className="font-semibold">{unique.map(c => c === " " ? "spasi" : `"${c}"`).join(", ")}</span>.
                      Jangan gunakan tanda baca, spasi, atau simbol — gunakan huruf kecil &amp; angka saja.
                      {cleaned && <> Coba: <span className="font-mono font-semibold">{cleaned}</span></>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Ingat saya */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border border-white/40 bg-background/80 accent-primary cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-white/90 text-shadow-soft group-hover:text-white transition-colors">
                Ingat saya
              </span>
            </label>

            {error && (
              <div role="alert" className="text-sm text-white bg-destructive/80 border border-destructive/40 rounded-lg px-4 py-2.5 text-shadow-soft">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl py-3.5 text-sm font-semibold tracking-wide text-[hsl(var(--login-btn-foreground))] bg-[hsl(var(--login-btn))] hover:bg-[hsl(var(--login-btn-hover))] shadow-[0_10px_30px_-8px_hsl(var(--login-btn)/0.55)] ring-1 ring-white/25 transition-all duration-300 hover:ring-white/40 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {/* sheen sweep */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    Masuk
                  </>
                )}
              </span>
            </button>

          </form>

          {/* Copyright */}
          {copyrightEnabled && (copyrightText?.trim()) && (
            <footer className="flex items-center justify-center gap-1.5 text-white/85 text-xs mt-6 text-shadow-soft">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500 drop-shadow-[0_0_4px_rgba(244,63,94,0.6)] md:animate-pulse" aria-hidden="true" />
              <span>{copyrightText}</span>
            </footer>
          )}

        </div>
      </div>}
    </main>
  );
}
