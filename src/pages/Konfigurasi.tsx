import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Save, CalendarDays, Settings, Heart } from "lucide-react";
import { updateSetting } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ImageLinkGenerator from "@/components/ImageLinkGenerator";

const SEMESTER_OPTIONS = ["Ganjil", "Genap"];
const TAHUN_AJARAN_OPTIONS = [
  "2023/2024",
  "2024/2025",
  "2025/2026",
  "2026/2027",
  "2027/2028",
];

export default function Konfigurasi() {
  const { user } = useAuth();
  const settings = useAppSettings();
  usePageTitle("Konfigurasi");
  const { toast } = useToast();
  const [localSemester, setLocalSemester] = useState("");
  const [localTahunAjaran, setLocalTahunAjaran] = useState("");
  const [localAppName, setLocalAppName] = useState("");
  const [localSubDesc, setLocalSubDesc] = useState("");
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [localBgLoginUrl, setLocalBgLoginUrl] = useState("");
  const [localCopyrightText, setLocalCopyrightText] = useState("");
  const [localCopyrightEnabled, setLocalCopyrightEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings.loaded && !initialized) {
      setLocalSemester(settings.semester);
      setLocalTahunAjaran(settings.tahunAjaran);
      setLocalAppName(settings.appName);
      setLocalSubDesc(settings.subDesc);
      setLocalLogoUrl(settings.logoUrl);
      setLocalBgLoginUrl(settings.bgLoginUrl);
      setLocalCopyrightText(settings.copyrightText);
      setLocalCopyrightEnabled(settings.copyrightEnabled);
      setInitialized(true);
    }
  }, [settings.loaded, initialized]);

  if (!user || user.role !== "ADMIN") return null;

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      updateSetting("semester", localSemester),
      updateSetting("tahun_ajaran", localTahunAjaran),
      updateSetting("app_name", localAppName),
      updateSetting("sub_desc", localSubDesc),
      updateSetting("logo_url", localLogoUrl),
      updateSetting("bg_login_url", localBgLoginUrl),
      updateSetting("copyright_text", localCopyrightText),
      updateSetting("copyright_enabled", localCopyrightEnabled ? "true" : "false"),
    ]);
    settings.setSemester(localSemester);
    settings.setTahunAjaran(localTahunAjaran);
    settings.setAppName(localAppName);
    settings.setSubDesc(localSubDesc);
    settings.setLogoUrl(localLogoUrl);
    settings.setBgLoginUrl(localBgLoginUrl);
    settings.setCopyrightText(localCopyrightText);
    settings.setCopyrightEnabled(localCopyrightEnabled);
    setSaving(false);
    toast({ title: "Berhasil", description: "Konfigurasi berhasil disimpan" });
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40 flex-shrink-0">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Konfigurasi</h2>
        </div>
        <p className="text-xs sm:text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Atur tampilan dan identitas aplikasi
        </p>
      </div>

      {/* Semester & Tahun Ajaran */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Setting Akademik</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Semester</label>
            <select value={localSemester} onChange={(e) => setLocalSemester(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              {SEMESTER_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Tahun Ajaran</label>
            <select value={localTahunAjaran} onChange={(e) => setLocalTahunAjaran(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm">
              {TAHUN_AJARAN_OPTIONS.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Identitas Aplikasi */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Nama Aplikasi</label>
          <input value={localAppName} onChange={(e) => setLocalAppName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Sub Deskripsi</label>
          <input value={localSubDesc} onChange={(e) => setLocalSubDesc(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">URL Logo (Google Drive)</label>
          <input value={localLogoUrl} onChange={(e) => setLocalLogoUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">URL Background Login</label>
          <input value={localBgLoginUrl} onChange={(e) => setLocalBgLoginUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm" />
        </div>

        {/* Copyright Login */}
        <div className="rounded-lg border border-dashed border-border/70 p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Copyright Halaman Login</span>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={localCopyrightEnabled}
                onChange={(e) => setLocalCopyrightEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-foreground">{localCopyrightEnabled ? "Aktif" : "Nonaktif"}</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Teks Copyright</label>
            <input
              value={localCopyrightText}
              onChange={(e) => setLocalCopyrightText(e.target.value)}
              placeholder="Palevi Official"
              disabled={!localCopyrightEnabled}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Menyimpan..." : "Simpan Konfigurasi"}
        </button>
      </div>

      {/* Generator Link Gambar */}
      <ImageLinkGenerator />
    </div>
  );
}
