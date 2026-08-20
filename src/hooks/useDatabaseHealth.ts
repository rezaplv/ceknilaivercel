import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Ambang batas (perkiraan untuk Lovable Cloud / Supabase free tier ~500MB)
const ROW_WARN_THRESHOLD = 80_000;   // total baris di tabel utama
const ROW_CRITICAL_THRESHOLD = 150_000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 menit

// Kode error Postgres/Supabase yang menandakan overload
const OVERLOAD_CODES = new Set([
  "53300", // too_many_connections
  "53400", // configuration_limit_exceeded
  "57014", // query_canceled (timeout)
  "57P03", // cannot_connect_now
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "XX000", // internal_error (sering muncul saat overload)
]);

const OVERLOAD_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

let overloadToastShownAt = 0;
let sizeToastShownAt = 0;
const TOAST_COOLDOWN_MS = 60_000; // jangan spam, max 1x per menit

function notifyOverload(detail?: string) {
  const now = Date.now();
  if (now - overloadToastShownAt < TOAST_COOLDOWN_MS) return;
  overloadToastShownAt = now;
  toast.error("Database sedang overload", {
    description:
      detail ||
      "Server database kelebihan beban atau tidak merespons. Coba beberapa saat lagi, atau pertimbangkan untuk upgrade kapasitas Lovable Cloud.",
    duration: 10000,
  });
}

function notifyNearlyFull(totalRows: number, level: "warn" | "critical") {
  const now = Date.now();
  if (now - sizeToastShownAt < TOAST_COOLDOWN_MS * 10) return; // 10 menit
  sizeToastShownAt = now;
  if (level === "critical") {
    toast.error("Kapasitas database hampir penuh", {
      description: `Total ${totalRows.toLocaleString("id-ID")} baris terdeteksi. Segera arsipkan/hapus data lama atau upgrade kapasitas Lovable Cloud agar aplikasi tetap stabil.`,
      duration: 12000,
    });
  } else {
    toast.warning("Database mendekati batas kapasitas", {
      description: `Total ${totalRows.toLocaleString("id-ID")} baris pada tabel utama. Pertimbangkan untuk merapikan data lama.`,
      duration: 8000,
    });
  }
}

export function checkErrorForOverload(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; status?: number; message?: string };
  if (e.code && OVERLOAD_CODES.has(e.code)) {
    notifyOverload(e.message);
    return true;
  }
  if (e.status && OVERLOAD_HTTP_STATUS.has(e.status)) {
    notifyOverload(e.message);
    return true;
  }
  const msg = (e.message || "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("too many") ||
    msg.includes("overload") ||
    msg.includes("rate limit") ||
    msg.includes("statement timeout") ||
    msg.includes("canceling statement")
  ) {
    notifyOverload(e.message);
    return true;
  }
  return false;
}

export function useDatabaseHealth() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSize = async () => {
      try {
        // Tabel paling banyak baris di app ini
        const tables = ["scores", "nilai_pengelolaan", "backup_logs"] as const;
        let total = 0;
        let hadError = false;

        for (const t of tables) {
          const { count, error } = await supabase
            .from(t)
            .select("*", { count: "exact", head: true });
          if (error) {
            hadError = true;
            checkErrorForOverload(error);
            continue;
          }
          total += count ?? 0;
        }

        if (cancelled || hadError) return;

        if (total >= ROW_CRITICAL_THRESHOLD) {
          notifyNearlyFull(total, "critical");
        } else if (total >= ROW_WARN_THRESHOLD) {
          notifyNearlyFull(total, "warn");
        }
      } catch (err) {
        checkErrorForOverload(err);
      }
    };

    // Cek awal setelah 10 detik agar tidak mengganggu boot
    const initial = setTimeout(checkSize, 10_000);
    intervalRef.current = setInterval(checkSize, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
