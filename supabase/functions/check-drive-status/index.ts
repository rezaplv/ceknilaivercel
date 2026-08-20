// Cek status koneksi Google Drive (Google Cloud Service Account)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, "")
    .replace(/-----END[ A-Z_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64url(input: string | Uint8Array): string {
  let b64: string;
  if (typeof input === "string") {
    b64 = btoa(input);
  } else {
    let binary = "";
    for (let i = 0; i < input.length; i++) {
      binary += String.fromCharCode(input[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const message = `${encodedHeader}.${encodedClaim}`;

  const keyData = pemToBinary(sa.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message)
  );

  const jwt = `${message}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Autentikasi Google gagal [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawSaJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  let serviceAccount: any = null;

  if (rawSaJson) {
    try {
      serviceAccount = typeof rawSaJson === "string" ? JSON.parse(rawSaJson) : rawSaJson;
    } catch {
      // Jika format string ter-escaped
      try {
        serviceAccount = JSON.parse(JSON.parse(`"${rawSaJson}"`));
      } catch {
        serviceAccount = null;
      }
    }
  }

  const result: any = {
    service_account_present: !!serviceAccount?.client_email && !!serviceAccount?.private_key,
    client_email: serviceAccount?.client_email ?? null,
    project_id: serviceAccount?.project_id ?? null,
    gateway_ok: false,
    gateway_status: null,
    gateway_latency_ms: null,
    gateway_error: null,
    checked_at: new Date().toISOString(),
  };

  if (!result.service_account_present) {
    result.gateway_error = "Secret GOOGLE_SERVICE_ACCOUNT_JSON belum dikonfigurasi di Supabase Edge Functions Secrets.";
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const t0 = Date.now();
    const token = await getGoogleAccessToken(serviceAccount);
    
    // Test fetch Google Drive API v3
    const driveRes = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    result.gateway_latency_ms = Date.now() - t0;
    result.gateway_status = driveRes.status;

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      result.gateway_error = `Google Drive API Error [${driveRes.status}]: ${errText}`;
      result.gateway_ok = false;
    } else {
      result.gateway_ok = true;
    }
  } catch (e: any) {
    result.gateway_error = e?.message ?? String(e);
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
