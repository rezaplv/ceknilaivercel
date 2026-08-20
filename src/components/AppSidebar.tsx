import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  LayoutDashboard,
  ClipboardEdit,
  BarChart3,
  Users,
  Settings,
  Megaphone,
  GraduationCap,
  Menu,
  LogOut,
  ChevronRight,
  GripVertical,
  School,
  FileText,
  Sparkles,
  CloudUpload,
  ShieldCheck,
  ClipboardList,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const ADMIN_MENU: MenuItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai" },
  { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai" },
  { label: "Nilai Asli", icon: FileText, path: "/nilai-asli" },
  { label: "Tagihan", icon: ClipboardList, path: "/tagihan" },
  { label: "Pengelolaan Nilai", icon: Sparkles, path: "/pengelolaan-nilai" },
  { label: "Manajemen User", icon: Users, path: "/manajemen-user" },
  { label: "Kelas & Mapel", icon: School, path: "/kelas-mapel" },
  { label: "Konfigurasi", icon: Settings, path: "/konfigurasi" },
  { label: "Broadcast", icon: Megaphone, path: "/broadcast" },
  { label: "Riwayat Backup", icon: CloudUpload, path: "/riwayat-backup" },
  { label: "Status Drive", icon: ShieldCheck, path: "/status-drive" },
];

const GURU_MENU: MenuItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai" },
  { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai" },
  { label: "Nilai Asli", icon: FileText, path: "/nilai-asli" },
  { label: "Tagihan", icon: ClipboardList, path: "/tagihan" },
  { label: "Pengelolaan Nilai", icon: Sparkles, path: "/pengelolaan-nilai" },
  { label: "Broadcast", icon: Megaphone, path: "/broadcast" },
];

const SISWA_MENU: MenuItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Hasil Belajar", icon: GraduationCap, path: "/hasil-belajar" },
  { label: "Papan Peringkat", icon: Trophy, path: "/papan-peringkat" },
];

function getInitialMenu(role: string): MenuItem[] {
  return role === "ADMIN" ? [...ADMIN_MENU] : role === "GURU" ? [...GURU_MENU] : [...SISWA_MENU];
}

export default function AppSidebar() {
  const { user, logout } = useAuth();
  const { appName, subDesc, logoUrl } = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>(() => getInitialMenu(""));

  // Drag state
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLButtonElement | null>(null);

  // Update menu when user role changes
  const currentRole = user?.role || "";
  useEffect(() => {
    if (currentRole) setMenu(getInitialMenu(currentRole));
  }, [currentRole]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }, []);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const roleLabel = user.role === "ADMIN" ? "Administrator" : user.role === "GURU" ? "Guru" : "Siswa";

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.4";
      }
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      setMenu((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(dragIndex, 1);
        updated.splice(overIndex, 0, removed);
        return updated;
      });
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleDragLeave = () => {
    setOverIndex(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full sidebar-gradient overflow-hidden">
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 px-5 py-5 flex-shrink-0",
        collapsed && "justify-center px-2"
      )}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[hsl(var(--sidebar-text-active))] truncate uppercase tracking-wide font-display">
              {appName || "Sistem Nilai"}
            </h1>
            <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate">
              {subDesc || "Manajemen Penilaian Sekolah"}
            </p>
          </div>
        )}
      </div>

      {/* User Info Card */}
      <div className={cn(
        "px-4 pb-4 flex-shrink-0",
        collapsed && "px-2"
      )}>
        <div className={cn(
          "flex items-center gap-3 px-3 py-3 rounded-xl bg-[hsl(var(--sidebar-bg-hover))]",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-9 h-9 rounded-full bg-[hsl(var(--stat-green))] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
            {user.nama_lengkap?.charAt(0)?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--sidebar-text-active))] truncate uppercase">
                {user.nama_lengkap}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="relative inline-flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-[hsl(var(--stat-green))] opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-[hsl(var(--stat-green))]" />
                </span>
                <span className="text-[11px] text-[hsl(var(--stat-green))] animate-pulse">Online</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Label + Items */}
      <nav className="flex-1 min-h-0 px-4 overflow-y-auto overscroll-contain scroll-smooth sidebar-scrollbar">
        {!collapsed && (
          <p className="text-[11px] font-semibold text-[hsl(var(--sidebar-text))] uppercase tracking-wider mb-3 px-1">
            Main Menu
          </p>
        )}
        <div className="space-y-1">
          {menu.map((item, index) => (
            <button
              key={item.path}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDragLeave={handleDragLeave}
              onClick={() => handleNav(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base font-medium group",
                "transition-[background,color,box-shadow,transform] duration-150 ease-out will-change-[background-color,color]",
                "hover:translate-x-0.5 active:scale-[0.98]",
                collapsed && "justify-center px-2",
                isActive(item.path)
                  ? "bg-gradient-to-r from-orange-500 via-orange-600 to-rose-600 text-white shadow-lg shadow-orange-500/40"
                  : "text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-bg-hover))] hover:text-orange-400",
                dragIndex === index && "opacity-40",
                overIndex === index && dragIndex !== null && dragIndex !== index &&
                  (dragIndex < index
                    ? "border-b-2 border-primary"
                    : "border-t-2 border-primary")
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 flex-shrink-0 transition-[color,transform,stroke-width] duration-150 ease-out",
                  isActive(item.path)
                    ? "text-white"
                    : "text-[hsl(var(--sidebar-text))] group-hover:text-orange-400 group-hover:scale-110"
                )}
                strokeWidth={isActive(item.path) ? 2.5 : 2}
              />
              {!collapsed && (
                <span className="truncate transition-colors duration-150 ease-out">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Logout Button */}
      <div className={cn(
        "p-4 flex-shrink-0",
        collapsed && "p-2"
      )}>
        <button
          onClick={() => setShowLogoutDialog(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors",
            collapsed && "px-2"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari aplikasi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={logout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <aside
      onWheel={(e) => {
        const nav = e.currentTarget.querySelector<HTMLElement>('nav');
        if (nav) {
          nav.scrollTop += e.deltaY;
          if (nav.scrollHeight > nav.clientHeight) {
            e.preventDefault();
          }
        }
      }}
      className={cn(
        "hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 h-screen sticky top-0 overscroll-contain",
        collapsed ? "w-[64px]" : "w-[260px]"
      )}
    >
      {sidebarContent}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
      >
        <ChevronRight
          className={cn("w-3.5 h-3.5 transition-transform", collapsed ? "" : "rotate-180")}
        />
      </button>
    </aside>
  );
}
