import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute, PublicRoute } from "@/components/RouteGuards";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";

// Halaman sekunder dimuat terpisah agar bundle awal ringan dan navigasi cepat
const loaders = {
  InputNilai: () => import("@/pages/InputNilai"),
  RekapNilai: () => import("@/pages/RekapNilai"),
  NilaiAsli: () => import("@/pages/NilaiAsli"),
  PengelolaanNilai: () => import("@/pages/PengelolaanNilai"),
  ManajemenUser: () => import("@/pages/ManajemenUser"),
  Konfigurasi: () => import("@/pages/Konfigurasi"),
  Broadcast: () => import("@/pages/Broadcast"),
  HasilBelajar: () => import("@/pages/HasilBelajar"),
  DaftarKelasMapel: () => import("@/pages/DaftarKelasMapel"),
  RiwayatBackup: () => import("@/pages/RiwayatBackup"),
  StatusDrive: () => import("@/pages/StatusDrive"),
  Tagihan: () => import("@/pages/Tagihan"),
  PapanPeringkat: () => import("@/pages/PapanPeringkat"),
  NotFound: () => import("@/pages/NotFound"),
};

const InputNilai = lazy(loaders.InputNilai);
const RekapNilai = lazy(loaders.RekapNilai);
const NilaiAsli = lazy(loaders.NilaiAsli);
const PengelolaanNilai = lazy(loaders.PengelolaanNilai);
const ManajemenUser = lazy(loaders.ManajemenUser);
const Konfigurasi = lazy(loaders.Konfigurasi);
const Broadcast = lazy(loaders.Broadcast);
const HasilBelajar = lazy(loaders.HasilBelajar);
const DaftarKelasMapel = lazy(loaders.DaftarKelasMapel);
const RiwayatBackup = lazy(loaders.RiwayatBackup);
const StatusDrive = lazy(loaders.StatusDrive);
const Tagihan = lazy(loaders.Tagihan);
const PapanPeringkat = lazy(loaders.PapanPeringkat);
const NotFound = lazy(loaders.NotFound);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="p-6 space-y-4 animate-pulse">
    <div className="h-8 w-52 rounded-lg bg-muted" />
    <div className="h-28 rounded-xl bg-muted" />
    <div className="h-56 rounded-xl bg-muted" />
  </div>
);

/** Prefetch semua chunk halaman saat browser idle supaya perpindahan menu terasa instan. */
function RoutePrefetcher() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach((l) => { void l(); });
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppSettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <RoutePrefetcher />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/input-nilai" element={<InputNilai />} />
                  <Route path="/rekap-nilai" element={<RekapNilai />} />
                  <Route path="/nilai-asli" element={<NilaiAsli />} />
                  <Route path="/pengelolaan-nilai" element={<PengelolaanNilai />} />
                  <Route path="/manajemen-user" element={<ManajemenUser />} />
                  <Route path="/konfigurasi" element={<Konfigurasi />} />
                  <Route path="/broadcast" element={<Broadcast />} />
                  <Route path="/hasil-belajar" element={<HasilBelajar />} />
                  <Route path="/kelas-mapel" element={<DaftarKelasMapel />} />
                  <Route path="/riwayat-backup" element={<RiwayatBackup />} />
                  <Route path="/status-drive" element={<StatusDrive />} />
                  <Route path="/tagihan" element={<Tagihan />} />
                  <Route path="/papan-peringkat" element={<PapanPeringkat />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
        </AppSettingsProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
