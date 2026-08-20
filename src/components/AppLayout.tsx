import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileBottomNav from "./MobileBottomNav";
import { ThemeToggle } from "./ThemeToggle";
import { useBackupNotifications } from "@/hooks/useBackupNotifications";
import { useDatabaseHealth } from "@/hooks/useDatabaseHealth";

export default function AppLayout() {
  useBackupNotifications();
  useDatabaseHealth();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 p-4 lg:p-6 pb-[calc(9.5rem+env(safe-area-inset-bottom))] lg:pb-24">
        <Outlet />
      </main>
      <ThemeToggle floating />
      <MobileBottomNav />
    </div>
  );
}
