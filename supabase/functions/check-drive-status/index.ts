// Cek status koneksi Google Drive (apakah secret tersedia & gateway responsif)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");

  const result: any = {
    lovable_api_key_present: !!lovableKey,
    google_drive_api_key_present: !!driveKey,
    gateway_ok: false,
    gateway_status: null,
    gateway_outcome: null,
    gateway_latency_ms: null,
    gateway_error: null,
    checked_at: new Date().toISOString(),
  };

  if (!lovableKey || !driveKey) {
    result.gateway_error = !driveKey
      ? "GOOGLE_DRIVE_API_KEY belum tersedia — koneksi Google Drive belum di-link ke project."
      : "LOVABLE_API_KEY tidak tersedia.";
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const t0 = Date.now();
    const r = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
      },
    });
    result.gateway_latency_ms = Date.now() - t0;
    result.gateway_status = r.status;
    const body = await r.json().catch(() => ({}));
    result.gateway_outcome = body?.outcome ?? null;
    result.gateway_error = body?.error ?? null;
    result.gateway_ok = r.ok && (body?.outcome === "verified" || body?.outcome === "skipped");
  } catch (e: any) {
    result.gateway_error = e?.message ?? String(e);
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
