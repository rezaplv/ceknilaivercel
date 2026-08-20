import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CloudUpload, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Status {
  service_account_present: boolean;
  client_email: string | null;
  project_id: string | null;
  gateway_ok: boolean;
  gateway_status: number | null;
  gateway_latency_ms: number | null;
  gateway_error: string | null;
  checked_at: string;
}

const Row = ({ label, ok, value }: { label: string; ok: boolean; value: string }) => (
  <div className="flex items-center justify-between py-3 border-b last:border-0">
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="w-5 h-5 text-green-600" />
      ) : (
        <XCircle className="w-5 h-5 text-destructive" />
      )}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <Badge variant={ok ? "default" : "destructive"} className={ok ? "bg-green-600 hover:bg-green-600" : ""}>
      {value}
    </Badge>
  </div>
);

export default function StatusDrive() {
  usePageTitle("Status Google Drive");
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-drive-status", { body: {} });
      if (error) throw error;
      setStatus(data as Status);
    } catch (e: any) {
      toast.error("Gagal memeriksa status: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  if (user && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;

  const allGood = status?.service_account_present && status?.gateway_ok;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CloudUpload className="w-7 h-7 text-primary" />
            Status Koneksi Google Drive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verifikasi koneksi Google Cloud Service Account dan Google Drive API.
          </p>
        </div>
        <Button onClick={check} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Periksa Ulang
        </Button>
      </div>

      {/* Overall */}
      <Card className={allGood ? "border-green-600/40" : "border-destructive/40"}>
        <CardContent className="pt-6 flex items-center gap-4">
          {allGood ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-600" />
              <div>
                <p className="text-lg font-semibold text-green-600">Google Drive Terhubung</p>
                <p className="text-sm text-muted-foreground">Backup otomatis Google Drive siap berjalan.</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-destructive" />
              <div>
                <p className="text-lg font-semibold text-destructive">Belum Siap</p>
                <p className="text-sm text-muted-foreground">
                  Konfigurasikan Secret GOOGLE_SERVICE_ACCOUNT_JSON di Supabase Edge Functions.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail Pemeriksaan</CardTitle>
          <CardDescription>
            {status?.checked_at
              ? `Diperiksa: ${new Date(status.checked_at).toLocaleString("id-ID")}`
              : "Memuat..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!status ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Memeriksa...</p>
          ) : (
            <div>
              <Row
                label="Google Service Account"
                ok={status.service_account_present}
                value={status.service_account_present ? "Tersedia" : "Belum ada"}
              />
              {status.client_email && (
                <div className="py-2.5 px-3 bg-muted/40 rounded-lg my-2 text-xs font-mono break-all text-muted-foreground">
                  Email: {status.client_email}
                </div>
              )}
              <Row
                label="Koneksi Google Drive API"
                ok={status.gateway_ok}
                value={
                  status.gateway_ok
                    ? `OK (${status.gateway_latency_ms}ms)`
                    : status.gateway_status
                      ? `Gagal (HTTP ${status.gateway_status})`
                      : "Tidak terjangkau"
                }
              />
              {status.gateway_error && (
                <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                  <strong>Pesan Error:</strong> {status.gateway_error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
