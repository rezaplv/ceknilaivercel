import { useState } from "react";
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
  LogOut,
  School,
  FileText,
  Sparkles,
  MoreHorizontal,
  X,
  User as UserIcon,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const ADMIN_MENU: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai" },
  { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai" },
  { label: "Nilai Asli", icon: FileText, path: "/nilai-asli" },
  { label: "Pengelolaan", icon: Sparkles, path: "/pengelolaan-nilai" },
  { label: "Tagihan", icon: ClipboardList, path: "/tagihan" },
  { label: "Manajemen User", icon: Users, path: "/manajemen-user" },
  { label: "Kelas & Mapel", icon: School, path: "/kelas-mapel" },
  { label: "Konfigurasi", icon: Settings, path: "/konfigurasi" },
  { label: "Broadcast", icon: Megaphone, path: "/broadcast" },
];

const GURU_MENU: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Input Nilai", icon: ClipboardEdit, path: "/input-nilai" },
  { label: "Rekap Nilai", icon: BarChart3, path: "/rekap-nilai" },
  { label: "Nilai Asli", icon: FileText, path: "/nilai-asli" },
  { label: "Pengelolaan", icon: Sparkles, path: "/pengelolaan-nilai" },
  { label: "Tagihan", icon: ClipboardList, path: "/tagihan" },
  { label: "Broadcast", icon: Megaphone, path: "/broadcast" },
];

const SISWA_MENU: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Hasil Belajar", icon: GraduationCap, path: "/hasil-belajar" },
  { label: "Peringkat", icon: Trophy, path: "/papan-peringkat" },
];

function getMenu(role: string): NavItem[] {
  return role === "ADMIN" ? ADMIN_MENU : role === "GURU" ? GURU_MENU : SISWA_MENU;
}

export default function MobileBottomNav() {
  const { user, logout } = useAuth();
  const { appName, logoUrl } = useAppSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  if (!user) return null;

  const menu = getMenu(user.role || "");
  const isActive = (path: string) => location.pathname === path;

  // Always show "More" button (contains profile + logout). 
  // If menu fits within MAX_VISIBLE, show all menu items + More (no overflow items).
  // Otherwise, show first MAX_VISIBLE items + More (with overflow items in sheet).
  const MAX_VISIBLE = 4;
  const hasOverflow = menu.length > MAX_VISIBLE;
  const visibleItems = hasOverflow ? menu.slice(0, MAX_VISIBLE) : menu;
  const overflowItems = hasOverflow ? menu.slice(MAX_VISIBLE) : [];
  const showMore = true; // always render the More button so logout is always reachable

  const handleNav = (path: string) => {
    navigate(path);
    setMoreOpen(false);
  };

  const roleLabel =
    user.role === "ADMIN" ? "Administrator" : user.role === "GURU" ? "Guru" : "Siswa";

  // Check if active route is in overflow (to highlight More button)
  const moreActive = overflowItems.some((i) => isActive(i.path));

  return (
    <>
      {/* Bottom navigation bar - mobile only */}
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-40",
          "bg-background/85 backdrop-blur-xl",
          "border-t border-border/60",
          "shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        role="navigation"
        aria-label="Navigasi utama"
      >
        <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
          {visibleItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5",
                  "flex-1 min-w-0 py-1.5 px-1 rounded-xl",
                  "transition-all duration-300 ease-out",
                  "active:scale-90",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                {/* Active indicator pill */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary animate-in fade-in slide-in-from-top-1 duration-300"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center rounded-xl transition-all duration-150 ease-out",
                    active
                      ? "bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 shadow-md shadow-orange-500/40 w-11 h-7"
                      : "w-11 h-7"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-all duration-150 ease-out",
                      active ? "w-[22px] h-[22px] text-white" : "w-5 h-5"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-tight truncate max-w-full font-medium transition-all",
                    active ? "font-semibold" : ""
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {showMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5",
                "flex-1 min-w-0 py-1.5 px-1 rounded-xl",
                "transition-all duration-300 ease-out active:scale-90",
                moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Menu lainnya"
            >
              {moreActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <span
                className={cn(
                  "flex items-center justify-center rounded-xl w-11 h-7 transition-all duration-150 ease-out",
                  moreActive && "bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 shadow-md shadow-orange-500/40"
                )}
              >
                <MoreHorizontal className={cn("w-5 h-5", moreActive && "text-white")} strokeWidth={moreActive ? 2.5 : 2} />
              </span>
              <span className="text-[10px] leading-tight font-medium">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* "More" sheet drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="lg:hidden rounded-t-3xl border-t-0 p-0 max-h-[85vh] overflow-hidden"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Profile header */}
          <SheetHeader className="px-5 pt-3 pb-4 text-left">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-12 h-12 rounded-xl object-contain bg-muted/40 p-1.5"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground">
                  <GraduationCap className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base font-bold truncate uppercase tracking-wide">
                  {user.nama_lengkap || appName}
                </SheetTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative inline-flex w-2 h-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">Online</span>
                  <span className="text-xs text-muted-foreground">· {roleLabel}</span>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Menu grid - only render if there are overflow items */}
          {overflowItems.length > 0 && (
            <div className="px-4 pb-2 overflow-y-auto">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                Menu Lainnya
              </p>
              <div className="grid grid-cols-3 gap-2">
                {overflowItems.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl",
                        "transition-all duration-150 ease-out active:scale-95",
                        active
                          ? "bg-gradient-to-br from-orange-500/15 to-rose-500/10 text-orange-600 ring-1 ring-orange-500/40"
                          : "bg-muted/40 text-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 ease-out",
                          active
                            ? "bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 shadow-md shadow-orange-500/40"
                            : "bg-background"
                        )}
                      >
                        <Icon
                          className={cn("w-5 h-5", active && "text-white")}
                          strokeWidth={active ? 2.5 : 2}
                        />
                      </span>
                      <span className="text-[11px] font-medium text-center leading-tight">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                setMoreOpen(false);
                setShowLogoutDialog(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-destructive/10 text-destructive font-semibold text-sm hover:bg-destructive/15 active:scale-[0.98] transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logout confirm */}
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
            <AlertDialogAction
              onClick={logout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
