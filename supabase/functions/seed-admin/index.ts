import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const email = "admin@ceknilai.local";
    const username = "admin";
    const nama_lengkap = "Administrator Sekolah";

    // Use environment variable for initial password, or generate a random one
    const envPassword = Deno.env.get("INITIAL_ADMIN_PASSWORD");
    const generateRandomPassword = () => {
      const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
      let pwd = "";
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      for (const b of arr) pwd += chars[b % chars.length];
      return pwd;
    };
    const password = envPassword || generateRandomPassword();

    // Check if admin already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", "admin")
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ message: "Admin already exists", user_id: existingProfile.user_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin user
    const { data: newUser, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, nama_lengkap },
      });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Assign ADMIN role
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "ADMIN" });

    // Insert default settings
    await supabaseAdmin.from("settings").upsert([
      { key: "semester", value: "Genap" },
      { key: "tahun_ajaran", value: "2025/2026" },
      { key: "app_name", value: "Sistem Nilai" },
      { key: "sub_desc", value: "Manajemen Penilaian Sekolah" },
    ], { onConflict: "key" });

    // Only return the generated password if no env var was set (one-time display)
    const message = envPassword
      ? "Admin created with configured password."
      : `Admin created. Generated password: ${password} — change it immediately.`;

    return new Response(
      JSON.stringify({ success: true, user_id: userId, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
