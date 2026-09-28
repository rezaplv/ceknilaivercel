import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardEdit, BarChart3, Zap, FileText, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Users,
  GraduationCap,
  BookOpen,
  School,
  Clock,
  CalendarDays,
  Megaphone,
  RefreshCw,
  TrendingUp,
  Sparkles,
  Star,
  Award,
  Target,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBroadcasts, fetchStudentBroadcasts, fetchTeacherBroadcasts, fetchAllUsers, fetchRecentAuditLogs, callManageUsers, deleteBroadcast } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Activity, UserPlus, UserMinus, Edit } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";



function PingIndicator() {
  const [ping, setPing] = useState<number | null>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    const measure = async () => {
      try {
        const start = performance.now();
        await fetch(`${supabaseUrl}/rest/v1/`, {
          method: "HEAD",
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        setPing(Math.round(performance.now() - start));
      } catch {
        setPing(null);
      }
    };
    measure();
    const interval = setInterval(measure, 10000);
    return () => clearInterval(interval);
  }, [supabaseUrl]);

  const getColor = () => {
    if (ping === null) return "text-destructive";
    if (ping < 150) return "text-emerald-500";
    if (ping < 300) return "text-yellow-500";
    return "text-orange-500";
  };

  const getLabel = () => {
    if (ping === null) return "Offline";
    if (ping < 150) return "Stabil";
    if (ping < 300) return "Sedang";
    return "Lambat";
  };

  const dotColor = ping === null ? "bg-destructive" : ping < 150 ? "bg-emerald-500" : ping < 300 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm shadow-xs text-xs font-medium tracking-tight">
      <span className="relative flex h-2 w-2">
        {ping !== null && ping < 300 && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${ping < 150 ? "bg-emerald-400" : "bg-yellow-400"}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      <Wifi className={`w-3.5 h-3.5 ${getColor()}`} />
      <span className={`tabular-nums ${getColor()}`}>{ping !== null ? `${ping} ms` : "?"}</span>
      <span className="h-3 w-px bg-border/80" />
      <span className="text-muted-foreground/90 uppercase text-[10px] tracking-[0.12em]">{getLabel()}</span>
    </div>
  );
}

function RealtimeClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStrFull = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateStrShort = now.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
        <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="font-medium text-foreground/80 tracking-tight text-xs sm:text-sm">
          <span className="sm:hidden">{dateStrShort}</span>
          <span className="hidden sm:inline">{dateStrFull}</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
        <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="font-mono tabular-nums tracking-tight text-foreground/80 text-xs sm:text-sm">{timeStr}</span>
      </span>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  delay: number;
  loading?: boolean;
}

function StatCardSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 bg-muted/40 border border-border/50 shadow-sm h-full min-h-[120px] sm:min-h-[132px] flex flex-col justify-between opacity-0 animate-fade-in-up overflow-hidden relative"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" style={{ backgroundSize: "200% 100%" }} />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-muted-foreground/20" />
          <div className="h-7 sm:h-8 w-14 rounded bg-muted-foreground/25" />
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted-foreground/20 flex-shrink-0" />
      </div>
      <div className="h-3 w-16 rounded bg-muted-foreground/15 relative" />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, gradient, delay, loading }: StatCardProps) {
  const [count, setCount] = useState(0);
  const numValue = typeof value === "number" ? value : 0;

  useEffect(() => {
    if (loading || typeof value !== "number") return;
    let start = 0;
    const duration = 1000;
    const step = Math.max(1, Math.ceil(numValue / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= numValue) {
        setCount(numValue);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [numValue, value, loading]);

  if (loading) return <StatCardSkeleton delay={delay} />;

  return (
    <div
      className={`${gradient} rounded-xl p-4 sm:p-5 text-white shadow-lg opacity-0 animate-fade-in-up hover:scale-[1.03] hover:shadow-xl transition-all duration-300 cursor-default group h-full min-h-[120px] sm:min-h-[132px] flex flex-col justify-between`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-white/80 truncate">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-1 tabular-nums leading-none">
            {typeof value === "number" ? count : value}
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:animate-float transition-transform flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[11px] sm:text-xs text-white/60">
        <TrendingUp className="w-3 h-3" />
        <span>Data terkini</span>
      </div>
    </div>
  );
}

interface BroadcastDisplayItem {
  id: string;
  title: string;
  message: string;
  target_kelas: string[];
  target_mapel: string[];
  created_at: string;
}

function CollapsibleBadgeList({
  items,
  icon: Icon,
  emptyText,
  tone,
  initialCount = 6,
}: {
  items: string[];
  icon: any;
  emptyText: string;
  tone: "primary" | "accent";
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>;
  }
  const showAll = expanded || items.length <= initialCount;
  const visible = showAll ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;
  const badgeClass =
    tone === "primary"
      ? "bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/40"
      : "bg-accent/10 text-accent border border-accent/20 dark:bg-accent/25 dark:text-accent-foreground dark:border-accent/50";
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((v) => (
        <span
          key={v}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${badgeClass}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {v}
        </span>
      ))}
      {items.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground text-xs sm:text-sm font-medium transition-all duration-200"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Ringkas
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Lihat selengkapnya (+{hiddenCount})
            </>
          )}
        </button>
      )}
    </div>
  );
}

function BroadcastCard({ item, index, onDelete, canDelete }: { item: BroadcastDisplayItem; index: number; onDelete?: (id: string) => void; canDelete?: boolean }) {
  const kelasLabel = (item as any).target_kelas_names?.length > 0
    ? (item as any).target_kelas_names.join(", ")
    : (!item.target_kelas || item.target_kelas.length === 0 ? "Semua Kelas" : item.target_kelas.join(", "));
  const mapelLabel = (item as any).target_mapel_names?.length > 0
    ? (item as any).target_mapel_names.join(", ")
    : (!item.target_mapel || item.target_mapel.length === 0 ? "Semua Mapel" : item.target_mapel.join(", "));
  const targetLabel = `${kelasLabel} untuk ${mapelLabel}`;

  return (
    <div
      className="border rounded-xl p-4 hover:bg-muted/50 hover:border-primary/20 hover:shadow-md transition-all duration-300 opacity-0 animate-fade-in-up group cursor-default"
      style={{ animationDelay: `${400 + index * 100}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
          <Megaphone className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.title}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.message}</p>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground flex-wrap">
            <span>{targetLabel}</span>
            <span className="opacity-50">•</span>
            <span>{new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        {canDelete && onDelete && (
          <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function QuickAccess({ items }: { items: { label: string; icon: any; path: string; color: string }[] }) {
  const navigate = useNavigate();
  return (
    <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="text-lg font-semibold">Akses Cepat</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="bg-card border rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center gap-2 hover:border-primary hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { semester, tahunAjaran } = useAppSettings();
  usePageTitle("Dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastDisplayItem[]>([]);
  const [stats, setStats] = useState({ guru: 0, siswa: 0, kelas: 0, mapel: 0 });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const { toast } = useToast();
  const [showCleaningData, setShowCleaningData] = useState(false);
  const [cleaningTarget, setCleaningTarget] = useState<"SISWA" | "GURU" | null>(null);
  const [cleaningConfirmText, setCleaningConfirmText] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadData = async () => {
    try {
      if (user?.role === "SISWA") {
        const broadcastData = await fetchStudentBroadcasts();
        setBroadcasts(broadcastData);
      } else if (user?.role === "GURU") {
        // Guru hanya melihat broadcast dari ADMIN di dashboard
        const broadcastData = await fetchTeacherBroadcasts();
        setBroadcasts(broadcastData);

        // Hitung total siswa di semua kelas yang diampu guru ini
        if (user?.kelas && user.kelas.length > 0) {
          // Ambil kelas_id berdasarkan nama kelas guru
          const { data: kelasData } = await supabase
            .from("kelas")
            .select("id")
            .in("nama", user.kelas);
          const kelasIds = (kelasData || []).map((k: any) => k.id);

          if (kelasIds.length > 0) {
            // Ambil user_id siswa di kelas-kelas tersebut
            const { data: userKelasData } = await supabase
              .from("user_kelas")
              .select("user_id")
              .in("kelas_id", kelasIds);
            const userIds = [...new Set((userKelasData || []).map((uk: any) => uk.user_id))];

            if (userIds.length > 0) {
              // Filter hanya yang berperan SISWA
              const { data: studentRoles } = await supabase
                .from("user_roles")
                .select("user_id")
                .eq("role", "SISWA")
                .in("user_id", userIds);
              setStats(prev => ({ ...prev, siswa: (studentRoles || []).length }));
            } else {
              setStats(prev => ({ ...prev, siswa: 0 }));
            }
          } else {
            setStats(prev => ({ ...prev, siswa: 0 }));
          }
        } else {
          setStats(prev => ({ ...prev, siswa: 0 }));
        }
      } else {
        const [allUsers, broadcastData, logs] = await Promise.all([
          fetchAllUsers(),
          fetchBroadcasts(),
          fetchRecentAuditLogs(10),
        ]);
        const activeKelas = new Set(allUsers.flatMap((u) => u.kelas));
        const activeMapel = new Set(allUsers.flatMap((u) => u.mapel));
        setStats({
          guru: allUsers.filter((u) => u.role === "GURU").length,
          siswa: allUsers.filter((u) => u.role === "SISWA").length,
          kelas: activeKelas.size,
          mapel: activeMapel.size,
        });
        setBroadcasts(broadcastData);
        setAuditLogs(logs);
      }
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime subscription for broadcasts
    const channel = supabase
      .channel('broadcasts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!user) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await deleteBroadcast(id);
      toast({ title: "Dihapus", description: "Pengumuman berhasil dihapus" });
      loadData();
    } catch {
      toast({ title: "Error", description: "Gagal menghapus pengumuman", variant: "destructive" });
    }
  };

  const handleCleanData = async () => {
    if (!cleaningTarget) return;
    setCleaning(true);
    try {
      const res = await callManageUsers("delete-users-bulk", { role: cleaningTarget });
      if (res.error) {
        toast({ title: "Gagal", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Berhasil", description: `${res.deleted || 0} data ${cleaningTarget} berhasil dihapus.` });
        await loadData();
      }
    } catch {
      toast({ title: "Error", description: "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setCleaning(false);
      setCleaningTarget(null);
      setCleaningConfirmText("");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 animate-fade-in">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground truncate">
            Dashboard
          </h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <RealtimeClock />
            <PingIndicator />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="hover:shadow-md transition-shadow flex-shrink-0 px-2.5 sm:px-3"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Greeting Card for Admin & Guru */}
      {(user.role === "ADMIN" || user.role === "GURU") && (
        <div className="relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 rounded-xl p-5 sm:p-6 text-primary-foreground shadow-lg animate-scale-in">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute right-12 top-4">
            <Sparkles className="w-6 h-6 text-white/20 animate-float" />
          </div>
          <div className="relative">
            <h3 className="text-lg sm:text-xl font-bold">
              Selamat Datang, {user.nama_lengkap}! 👋
            </h3>
            <p className="text-xs sm:text-sm mt-1 text-primary-foreground/80">
              {user.role === "ADMIN"
                ? "Anda login sebagai Administrator. Kelola sistem dengan mudah dari dashboard ini."
                : "Anda login sebagai Guru. Pantau perkembangan siswa dan kelola nilai dari sini."}
            </p>
          </div>
        </div>
      )}

      {/* Admin Dashboard */}
      {user.role === "ADMIN" && (
        <>
          <div className="bg-card border rounded-xl p-3.5 sm:p-4 flex items-center gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "50ms", animationFillMode: "forwards" }}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Semester {semester} <span className="text-muted-foreground font-normal">·</span> {tahunAjaran}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Periode akademik aktif</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Total Guru" value={stats.guru} icon={Users} gradient="stat-card-blue" delay={100} loading={statsLoading} />
            <StatCard label="Total Siswa" value={stats.siswa} icon={GraduationCap} gradient="stat-card-green" delay={200} loading={statsLoading} />
            <StatCard label="Total Kelas" value={stats.kelas} icon={School} gradient="stat-card-orange" delay={300} loading={statsLoading} />
            <StatCard label="Total Mapel" value={stats.mapel} icon={BookOpen} gradient="stat-card-purple" delay={400} loading={statsLoading} />
          </div>

          <QuickAccess items={[
            { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai", color: "bg-blue-500" },
            { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai", color: "bg-green-500" },
            { label: "Manajemen User", icon: Users, path: "/manajemen-user", color: "bg-orange-500" },
            { label: "Broadcast", icon: Megaphone, path: "/broadcast", color: "bg-purple-500" },
          ]} />

          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-lg font-semibold">Aktivitas Terbaru</h3>
            </div>
            <div className="bg-card border rounded-xl divide-y">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => {
                  const actionMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
                    "create-user": { label: "Menambah user", icon: UserPlus, color: "text-emerald-500" },
                    "delete-user": { label: "Menghapus user", icon: UserMinus, color: "text-destructive" },
                    "delete-users-bulk": { label: "Menghapus user (bulk)", icon: UserMinus, color: "text-destructive" },
                    "update-user": { label: "Memperbarui user", icon: Edit, color: "text-blue-500" },
                    "reset-password": { label: "Reset password", icon: Edit, color: "text-orange-500" },
                  };
                  const info = actionMap[log.action] || { label: log.action, icon: Activity, color: "text-muted-foreground" };
                  const IconComp = info.icon;
                  const performer = log.profiles?.username || "system";
                  const details = log.details as any;
                  const targetName = details?.username || details?.target_role || "";
                  const timeStr = new Date(log.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${info.color}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{performer}</span>
                          {" "}{info.label}
                          {targetName && <> <span className="font-medium">{targetName}</span></>}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeStr}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
                </div>
              )}
            </div>
          </div>
          {/* Cleaning Data */}
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
            <button
              onClick={() => setShowCleaningData(!showCleaningData)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Cleaning Data</span>
              {showCleaningData ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCleaningData && (
              <div className="mt-3 bg-card border border-destructive/20 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Hapus Data Pengguna</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Menghapus semua data pengguna berdasarkan peran beserta nilai, kelas, dan mapel terkait. Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCleaningTarget("SISWA")}
                    disabled={cleaning}
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Semua Siswa ({stats.siswa})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCleaningTarget("GURU")}
                    disabled={cleaning}
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Semua Guru ({stats.guru})
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cleaning Confirmation Dialog */}
          <AlertDialog
            open={!!cleaningTarget}
            onOpenChange={(open) => {
              if (!open) {
                setCleaningTarget(null);
                setCleaningConfirmText("");
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Hapus Data {cleaningTarget}</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      Anda akan menghapus <strong>semua data {cleaningTarget}</strong> ({cleaningTarget === "SISWA" ? stats.siswa : stats.guru} akun) beserta nilai, kelas, dan mapel terkait. Tindakan ini <strong>permanen</strong> dan tidak dapat dibatalkan.
                    </p>
                    <p>
                      Untuk melanjutkan, ketik <strong className="text-destructive font-mono">HAPUS {cleaningTarget}</strong> di bawah ini:
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete" className="sr-only">Konfirmasi</Label>
                <Input
                  id="confirm-delete"
                  value={cleaningConfirmText}
                  onChange={(e) => setCleaningConfirmText(e.target.value)}
                  placeholder={`HAPUS ${cleaningTarget ?? ""}`}
                  autoComplete="off"
                  autoFocus
                  disabled={cleaning}
                  className="font-mono"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cleaning}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCleanData}
                  disabled={cleaning || cleaningConfirmText.trim() !== `HAPUS ${cleaningTarget}`}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {cleaning ? "Menghapus..." : "Ya, Hapus Semua"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>


          {/* Admin Broadcasts */}
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-primary" />
              <h3 className="text-lg font-semibold">Pengumuman</h3>
            </div>
            <div className="space-y-3">
              {broadcasts.length > 0 ? (
                broadcasts.map((b, i) => (
                  <BroadcastCard key={b.id} item={b} index={i} onDelete={handleDeleteBroadcast} canDelete />
                ))
              ) : (
                <div className="bg-card border rounded-xl p-6 text-center">
                  <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Guru Dashboard */}
      {user.role === "GURU" && (
        <>
          <div className="bg-card border rounded-xl p-3.5 sm:p-4 flex items-center gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "50ms", animationFillMode: "forwards" }}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Semester {semester} <span className="text-muted-foreground font-normal">·</span> {tahunAjaran}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Periode akademik aktif</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Kelas Diampu" value={user.kelas?.length || 0} icon={School} gradient="stat-card-green" delay={100} loading={statsLoading} />
            <StatCard label="Mapel Diajar" value={user.mapel?.length || 0} icon={BookOpen} gradient="stat-card-orange" delay={200} loading={statsLoading} />
            <StatCard label="Total Siswa" value={stats.siswa} icon={GraduationCap} gradient="stat-card-blue" delay={300} loading={statsLoading} />
          </div>

          <QuickAccess items={[
            { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai", color: "bg-blue-500" },
            { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai", color: "bg-green-500" },
            { label: "Nilai Asli", icon: FileText, path: "/nilai-asli", color: "bg-amber-500" },
            { label: "Tagihan", icon: ClipboardList, path: "/tagihan", color: "bg-purple-500" },
          ]} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-card border rounded-xl p-4 sm:p-5 opacity-0 animate-fade-in-up hover:shadow-md transition-all duration-300" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
              <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Kelas yang Diampu</h4>
              <CollapsibleBadgeList
                items={[...(user.kelas || [])].sort((a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" }))}
                icon={School}
                emptyText="Belum ada kelas"
                tone="primary"
              />
            </div>
            <div className="bg-card border rounded-xl p-4 sm:p-5 opacity-0 animate-fade-in-up hover:shadow-md transition-all duration-300" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
              <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mapel yang Diajar</h4>
              <CollapsibleBadgeList
                items={[...(user.mapel || [])].sort((a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" }))}
                icon={BookOpen}
                emptyText="Belum ada mapel"
                tone="accent"
              />
            </div>
          </div>

          {/* Guru Broadcasts */}
          <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-primary" />
              <h3 className="text-lg font-semibold">Pengumuman</h3>
            </div>
            <div className="space-y-3">
              {broadcasts.length > 0 ? (
                broadcasts.map((b, i) => (
                  <BroadcastCard key={b.id} item={b} index={i} onDelete={handleDeleteBroadcast} canDelete={false} />
                ))
              ) : (
                <div className="bg-card border rounded-xl p-6 text-center">
                  <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Siswa Dashboard */}
      {user.role === "SISWA" && (
        <>
          <div className="relative overflow-hidden rounded-2xl p-6 shadow-lg animate-scale-in" style={{ background: "linear-gradient(135deg, hsl(217 91% 45%) 0%, hsl(262 83% 55%) 50%, hsl(199 89% 48%) 100%)" }}>
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute right-10 bottom-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />
            <div className="absolute left-1/2 -top-4">
              <Sparkles className="w-8 h-8 text-white/15 animate-float" />
            </div>
            <div className="absolute right-8 top-6">
              <Star className="w-5 h-5 text-yellow-300/40 animate-float" style={{ animationDelay: "0.5s" }} />
            </div>
            <div className="relative text-white">
              <p className="text-sm font-medium text-white/70">{getGreeting()}</p>
              <h3 className="text-2xl font-bold mt-1">{user.nama_lengkap}</h3>
              <p className="text-sm mt-2 text-white/80">
                Pantau nilai dan pengumuman terbaru dari sekolah di halaman ini.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 text-white shadow-lg opacity-0 animate-fade-in-up hover:scale-[1.03] hover:shadow-xl transition-all duration-300 cursor-default group"
              style={{ background: "linear-gradient(135deg, hsl(217 91% 50%) 0%, hsl(217 91% 38%) 100%)", animationDelay: "100ms", animationFillMode: "forwards" }}>
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white/80">Kelas</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{user.kelas?.[0] || "Belum diatur"}</p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <School className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 text-white shadow-lg opacity-0 animate-fade-in-up hover:scale-[1.03] hover:shadow-xl transition-all duration-300 cursor-default group"
              style={{ background: "linear-gradient(135deg, hsl(142 71% 48%) 0%, hsl(160 64% 38%) 100%)", animationDelay: "200ms", animationFillMode: "forwards" }}>
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white/80">Mata Pelajaran</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{user.mapel?.length || 0}</p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 text-white shadow-lg opacity-0 animate-fade-in-up hover:scale-[1.03] hover:shadow-xl transition-all duration-300 cursor-default group col-span-2 sm:col-span-1"
              style={{ background: "linear-gradient(135deg, hsl(262 83% 58%) 0%, hsl(280 70% 45%) 100%)", animationDelay: "300ms", animationFillMode: "forwards" }}>
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10 blur-lg" />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white/80">Semester</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{semester}</p>
                  <p className="text-xs text-white/60 mt-0.5">{tahunAjaran}</p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <Award className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5 opacity-0 animate-fade-in-up hover:shadow-md transition-all duration-300" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Mata Pelajaran yang Diikuti</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {(user.mapel || []).map((m, idx) => {
                const colors = [
                  "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                  "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
                  "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                  "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800",
                  "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
                ];
                return (
                  <span
                    key={m}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-transform hover:scale-105 ${colors[idx % colors.length]}`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {m}
                  </span>
                );
              })}
              {(!user.mapel || user.mapel.length === 0) && (
                <span className="text-sm text-muted-foreground">Belum ada mapel</span>
              )}
            </div>
          </div>

          {/* Broadcasts */}
          <div className="opacity-0 animate-fade-in" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-primary" />
              <h3 className="text-lg font-semibold">Pengumuman</h3>
            </div>
            <div className="space-y-3">
              {broadcasts.length > 0 ? (
                broadcasts.map((b, i) => (
                  <BroadcastCard key={b.id} item={b} index={i} onDelete={handleDeleteBroadcast} canDelete={false} />
                ))
              ) : (
                <div className="bg-card border rounded-xl p-6 text-center">
                  <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman untuk Anda saat ini.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
