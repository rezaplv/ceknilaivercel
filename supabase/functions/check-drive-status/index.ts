// Cek status koneksi Google Drive (Google Apps Script Web App / Service Account)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const webAppUrl = Deno.env.get("GOOGLE_DRIVE_WEBAPP_URL");
  const rawSaJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

  const result: any = {
    service_account_present: !!rawSaJson,
    web_app_present: !!webAppUrl,
    mode: webAppUrl ? "Google Apps Script Web App" : "Service Account",
    gateway_ok: false,
    gateway_status: null,
    gateway_latency_ms: null,
    gateway_error: null,
    checked_at: new Date().toISOString(),
  };

  // 1. Jika menggunakan Google Apps Script Web App (Rekomendasi untuk Belajar.id & Gmail)
  if (webAppUrl) {
    try {
      const t0 = Date.now();
      const res = await fetch(webAppUrl, {
        method: "GET",
        redirect: "follow",
      });
      result.gateway_latency_ms = Date.now() - t0;
      result.gateway_status = res.status;

      if (res.ok) {
        result.gateway_ok = true;
      } else {
        result.gateway_error = `Web App mengembalikan status HTTP ${res.status}`;
      }
    } catch (e: any) {
      result.gateway_error = `Gagal menghubungi Web App: ${e?.message ?? String(e)}`;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Jika tidak ada Web App dan tidak ada Service Account
  if (!rawSaJson) {
    result.gateway_error = "Secret GOOGLE_DRIVE_WEBAPP_URL atau GOOGLE_SERVICE_ACCOUNT_JSON belum dikonfigurasi di Supabase.";
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  result.gateway_ok = true;
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
