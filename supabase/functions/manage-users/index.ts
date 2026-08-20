import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Input Validation ---
function validateUserInput(payload: Record<string, unknown>): { valid: boolean; error?: string } {
  const { username, nama_lengkap, password, kelas, mapel } = payload as {
    username?: string; nama_lengkap?: string; password?: string;
    kelas?: unknown[]; mapel?: unknown[];
  };

  if (username !== undefined) {
    if (typeof username !== "string" || username.length < 1 || username.length > 100) {
      return { valid: false, error: "Username: 1-100 karakter" };
    }
  }
  if (nama_lengkap !== undefined) {
    if (typeof nama_lengkap !== "string" || nama_lengkap.length < 1 || nama_lengkap.length > 100) {
      return { valid: false, error: "Nama lengkap: 1-100 karakter" };
    }
    if (/[\x00-\x1F\x7F]/.test(nama_lengkap)) {
      return { valid: false, error: "Nama mengandung karakter tidak valid" };
    }
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length > 72) {
      return { valid: false, error: "Password: maksimal 72 karakter" };
    }
  }
  if (kelas !== undefined && Array.isArray(kelas)) {
    if (kelas.length > 20) return { valid: false, error: "Maksimal 20 kelas per user" };
    for (const k of kelas) {
      if (typeof k !== "string" || k.length > 50) return { valid: false, error: "Nama kelas tidak valid" };
    }
  }
  if (mapel !== undefined && Array.isArray(mapel)) {
    if (mapel.length > 20) return { valid: false, error: "Maksimal 20 mapel per user" };
    for (const m of mapel) {
      if (typeof m !== "string" || m.length > 50) return { valid: false, error: "Nama mapel tidak valid" };
    }
  }
  return { valid: true };
}

// --- Rate Limiting (in-memory, per-isolate) ---
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds between sensitive ops

function checkRateLimit(callerId: string, action: string): boolean {
  const key = `${callerId}:${action}`;
  const now = Date.now();
  const last = rateLimitMap.get(key);
  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    return false; // rate limited
  }
  rateLimitMap.set(key, now);
  return true;
}

// Cleanup orphaned kelas/mapel entries (no users assigned)
async function cleanupOrphanedKelasMapel(supabaseAdmin: any) {
  // Get all kelas that have no user_kelas references
  const { data: allKelas } = await supabaseAdmin.from("kelas").select("id");
  const { data: usedKelas } = await supabaseAdmin.from("user_kelas").select("kelas_id");
  const usedKelasIds = new Set((usedKelas || []).map((uk: any) => uk.kelas_id));
  for (const k of (allKelas || [])) {
    if (!usedKelasIds.has(k.id)) {
      // Also check if kelas is used in scores
      const { data: scoredKelas } = await supabaseAdmin.from("scores").select("id").eq("kelas_id", k.id).limit(1);
      if (!scoredKelas || scoredKelas.length === 0) {
        await supabaseAdmin.from("kelas").delete().eq("id", k.id);
      }
    }
  }

  // Get all mapel that have no user_mapel references
  const { data: allMapel } = await supabaseAdmin.from("mapel").select("id");
  const { data: usedMapel } = await supabaseAdmin.from("user_mapel").select("mapel_id");
  const usedMapelIds = new Set((usedMapel || []).map((um: any) => um.mapel_id));
  for (const m of (allMapel || [])) {
    if (!usedMapelIds.has(m.id)) {
      const { data: scoredMapel } = await supabaseAdmin.from("scores").select("id").eq("mapel_id", m.id).limit(1);
      if (!scoredMapel || scoredMapel.length === 0) {
        await supabaseAdmin.from("mapel").delete().eq("id", m.id);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || (callerRole.role !== "ADMIN" && callerRole.role !== "GURU")) {
      return new Response(JSON.stringify({ error: "Admin or Guru only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerIsAdmin = callerRole.role === "ADMIN";
    const callerIsGuru = callerRole.role === "GURU";

    const { action, ...payload } = await req.json();

    // Guru can only manage SISWA — dan TIDAK BOLEH menghapus akun siswa.
    // Menghapus akun siswa akan menghapus seluruh nilai siswa tsb di semua
    // mapel/guru lain (karena akun auth siswa hilang). Hanya ADMIN yang boleh.
    if (callerIsGuru) {
      const restrictedActions = ["create-user", "create-users-batch", "update-user"];
      if (restrictedActions.includes(action)) {
        if (action === "create-user" && payload.role !== "SISWA") {
          return new Response(JSON.stringify({ error: "Guru hanya bisa menambah Siswa" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (action === "create-users-batch") {
          const hasNonSiswa = payload.users?.some((u: any) => u.role !== "SISWA");
          if (hasNonSiswa) {
            return new Response(JSON.stringify({ error: "Guru hanya bisa menambah Siswa" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
      if (action === "delete-user" || action === "delete-users-bulk" || action === "archive-user" || action === "restore-user" || action === "archive-users-by-kelas" || action === "restore-users-by-kelas" || action === "delete-users-by-kelas") {
        return new Response(JSON.stringify({
          error: "Hanya Admin yang dapat menghapus / mengarsipkan akun pengguna.",
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Rate limit sensitive operations
    const sensitiveActions = ["create-user", "create-users-batch", "delete-user", "delete-users-bulk", "delete-users-by-kelas"];
    if (sensitiveActions.includes(action) && !checkRateLimit(caller.id, action)) {
      return new Response(JSON.stringify({ error: "Terlalu cepat. Silakan tunggu sebentar." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: audit log
    async function auditLog(details: Record<string, unknown>) {
      await supabaseAdmin.from("audit_logs").insert({
        action,
        performed_by: caller!.id,
        target_user_id: details.target_user_id || null,
        target_role: details.target_role || null,
        details,
      });
    }

    // Tambahkan kelas/mapel yang belum dimiliki user (tanpa menduplikasi)
    async function mergeAssignments(userId: string, kelas?: string[], mapel?: string[]) {
      if (Array.isArray(kelas)) {
        for (const kelasNama of kelas) {
          let { data: kelasRow } = await supabaseAdmin.from("kelas").select("id").eq("nama", kelasNama).maybeSingle();
          if (!kelasRow) {
            const { data: ins } = await supabaseAdmin.from("kelas").insert({ nama: kelasNama }).select("id").single();
            kelasRow = ins;
          }
          if (!kelasRow) continue;
          const { data: exists } = await supabaseAdmin.from("user_kelas")
            .select("id").eq("user_id", userId).eq("kelas_id", kelasRow.id).maybeSingle();
          if (!exists) await supabaseAdmin.from("user_kelas").insert({ user_id: userId, kelas_id: kelasRow.id });
        }
      }
      if (Array.isArray(mapel)) {
        for (const mapelNama of mapel) {
          let { data: mapelRow } = await supabaseAdmin.from("mapel").select("id").eq("nama", mapelNama).maybeSingle();
          if (!mapelRow) {
            const { data: ins } = await supabaseAdmin.from("mapel").insert({ nama: mapelNama }).select("id").single();
            mapelRow = ins;
          }
          if (!mapelRow) continue;
          const { data: exists } = await supabaseAdmin.from("user_mapel")
            .select("id").eq("user_id", userId).eq("mapel_id", mapelRow.id).maybeSingle();
          if (!exists) await supabaseAdmin.from("user_mapel").insert({ user_id: userId, mapel_id: mapelRow.id });
        }
      }
    }

    // Cari user_id akun yang sudah ada berdasarkan username
    async function findExistingUserId(username: string): Promise<string | null> {
      const { data } = await supabaseAdmin.from("profiles").select("user_id").eq("username", username).maybeSingle();
      return data?.user_id ?? null;
    }

    if (action === "create-user") {

      const v = validateUserInput(payload);
      if (!v.valid) {
        return new Response(JSON.stringify({ error: v.error }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { username, password, nama_lengkap, role, kelas, mapel } = payload;
      const email = `${username}@ceknilai.local`;

      const { data: newUser, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { username, nama_lengkap },
        });

      if (createErr) {
        // Akun sudah ada: cukup tambahkan kelas/mapel baru ke akun tersebut
        const existingId = await findExistingUserId(username);
        if (existingId) {
          await mergeAssignments(existingId, kelas, mapel);
          await auditLog({ target_user_id: existingId, target_role: role, username, merged: true });
          return new Response(JSON.stringify({ success: true, user_id: existingId, merged: true }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = newUser.user.id;
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });

      await mergeAssignments(userId, kelas, mapel);

      await auditLog({ target_user_id: userId, target_role: role, username });

      return new Response(JSON.stringify({ success: true, user_id: userId }), {

        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-users-batch") {
      const { users } = payload;
      if (!Array.isArray(users) || users.length === 0) {
        return new Response(JSON.stringify({ error: "Data user tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: { username: string; success: boolean; error?: string; merged?: boolean }[] = [];

      for (const u of users) {
        const v = validateUserInput(u);
        if (!v.valid) {
          results.push({ username: u.username || "?", success: false, error: v.error });
          continue;
        }

        const email = `${u.username}@ceknilai.local`;
        const { data: newUser, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email, password: u.password, email_confirm: true,
            user_metadata: { username: u.username, nama_lengkap: u.nama_lengkap },
          });

        if (createErr) {
          const existingId = await findExistingUserId(u.username);
          if (existingId) {
            await mergeAssignments(existingId, u.kelas, u.mapel);
            results.push({ username: u.username, success: true, merged: true });
          } else {
            results.push({ username: u.username, success: false, error: createErr.message });
          }
          continue;
        }

        const userId = newUser.user.id;
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: u.role });

        await mergeAssignments(userId, u.kelas, u.mapel);

        results.push({ username: u.username, success: true });

      }

      await auditLog({ batch_count: users.length, results_summary: results.map(r => ({ username: r.username, success: r.success })) });

      return new Response(JSON.stringify({ results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-user") {
      const { user_id } = payload;
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Hanya hapus nilai milik user ini SEBAGAI SISWA. JANGAN hapus berdasarkan
      // created_by — itu akan menghapus nilai siswa lain yang kebetulan diinput
      // oleh guru ini, yang merupakan data milik siswa, bukan milik guru.
      await supabaseAdmin.from("scores").delete().eq("student_id", user_id);
      // Lepas referensi created_by supaya nilai siswa tetap utuh
      await supabaseAdmin.from("scores").update({ created_by: null }).eq("created_by", user_id);
      await supabaseAdmin.from("user_kelas").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_mapel").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CATATAN: cleanupOrphanedKelasMapel sengaja TIDAK dipanggil di sini.
      // Auto-delete kelas/mapel saat hapus 1 user bisa menghapus entitas yang
      // masih dipakai siswa/guru lain (atau yang akan dipakai). Admin bisa
      // menghapus kelas/mapel manual dari halaman Daftar Kelas & Mapel.

      await auditLog({ target_user_id: user_id });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-users-bulk") {
      const { role } = payload;
      if (!role || !["GURU", "SISWA"].includes(role)) {
        return new Response(JSON.stringify({ error: "Role tidak valid untuk bulk delete" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleUsers } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", role);

      const userIds = (roleUsers || []).map((ru: any) => ru.user_id);
      const totalCount = userIds.length;

      if (userIds.length > 0) {
        // Bulk delete data terkait. Untuk scores: hanya hapus baris di mana user
        // ini SEBAGAI SISWA (student_id). Jangan hapus berdasarkan created_by —
        // itu data milik siswa lain. Cukup lepas referensi created_by.
        await Promise.all([
          supabaseAdmin.from("scores").delete().in("student_id", userIds),
          supabaseAdmin.from("scores").update({ created_by: null }).in("created_by", userIds),
          supabaseAdmin.from("user_kelas").delete().in("user_id", userIds),
          supabaseAdmin.from("user_mapel").delete().in("user_id", userIds),
          supabaseAdmin.from("user_roles").delete().in("user_id", userIds),
          supabaseAdmin.from("profiles").delete().in("user_id", userIds),
        ]);

        // Delete auth users in parallel batches (auth.admin.deleteUser has no bulk API)
        const AUTH_BATCH = 20;
        for (let i = 0; i < userIds.length; i += AUTH_BATCH) {
          const batch = userIds.slice(i, i + AUTH_BATCH);
          await Promise.all(batch.map((uid: string) => supabaseAdmin.auth.admin.deleteUser(uid)));
        }
      }

      // CATATAN: cleanupOrphanedKelasMapel TIDAK dipanggil otomatis. Hapus
      // kelas/mapel manual dari halaman Daftar Kelas & Mapel jika perlu.

      await auditLog({ target_role: role, deleted_count: totalCount });
      return new Response(JSON.stringify({ success: true, deleted: totalCount }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-user") {
      const v = validateUserInput(payload);
      if (!v.valid) {
        return new Response(JSON.stringify({ error: v.error }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { user_id, username, nama_lengkap, kelas, mapel, password } = payload;
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("profiles").update({ username, nama_lengkap }).eq("user_id", user_id);
      const authUpdate: Record<string, unknown> = {
        email: `${username}@ceknilai.local`,
        user_metadata: { username, nama_lengkap },
      };
      if (password && typeof password === "string" && password.length >= 6) {
        authUpdate.password = password;
      }
      await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);

      await supabaseAdmin.from("user_kelas").delete().eq("user_id", user_id);
      if (kelas && kelas.length > 0) {
        for (const kelasNama of kelas) {
          if (!kelasNama.trim()) continue;
          let { data: kelasRow } = await supabaseAdmin.from("kelas").select("id").eq("nama", kelasNama.trim()).maybeSingle();
          if (!kelasRow) {
            const { data: ins } = await supabaseAdmin.from("kelas").insert({ nama: kelasNama.trim() }).select("id").single();
            kelasRow = ins;
          }
          if (kelasRow) await supabaseAdmin.from("user_kelas").insert({ user_id, kelas_id: kelasRow.id });
        }
      }

      await supabaseAdmin.from("user_mapel").delete().eq("user_id", user_id);
      if (mapel && mapel.length > 0) {
        for (const mapelNama of mapel) {
          if (!mapelNama.trim()) continue;
          let { data: mapelRow } = await supabaseAdmin.from("mapel").select("id").eq("nama", mapelNama.trim()).maybeSingle();
          if (!mapelRow) {
            const { data: ins } = await supabaseAdmin.from("mapel").insert({ nama: mapelNama.trim() }).select("id").single();
            mapelRow = ins;
          }
          if (mapelRow) await supabaseAdmin.from("user_mapel").insert({ user_id, mapel_id: mapelRow.id });
        }
      }

      // CATATAN: cleanupOrphanedKelasMapel TIDAK dipanggil di sini. Mengubah
      // kelas/mapel seorang guru tidak boleh menghapus entitas yang mungkin
      // masih dipakai oleh user lain atau direferensikan oleh nilai.

      await auditLog({ target_user_id: user_id, username });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "archive-user") {
      const { user_id } = payload;
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Allow archiving SISWA & GURU (ADMIN only — guru caller already blocked above for non-SISWA actions on non-SISWA targets)
      const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      if (targetRole && targetRole.role === "ADMIN") {
        return new Response(JSON.stringify({ error: "Akun ADMIN tidak dapat diarsipkan" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (callerIsGuru && targetRole?.role !== "SISWA") {
        return new Response(JSON.stringify({ error: "Guru hanya dapat mengarsipkan akun SISWA" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("profiles")
        .update({ archived_at: new Date().toISOString(), archived_by: caller.id })
        .eq("user_id", user_id);
      // Revoke active sessions so user is logged out immediately
      try { await supabaseAdmin.auth.admin.signOut(user_id); } catch (_) { /* ignore */ }
      await auditLog({ target_user_id: user_id, target_role: targetRole?.role || null, op: "archive" });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore-user") {
      const { user_id } = payload;
      if (!user_id || typeof user_id !== "string") {
        return new Response(JSON.stringify({ error: "user_id tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("profiles")
        .update({ archived_at: null, archived_by: null })
        .eq("user_id", user_id);
      await auditLog({ target_user_id: user_id, op: "restore" });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "archive-users-by-kelas" || action === "restore-users-by-kelas" || action === "delete-users-by-kelas") {
      const { kelas_nama } = payload;
      if (!kelas_nama || typeof kelas_nama !== "string") {
        return new Response(JSON.stringify({ error: "kelas_nama tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let studentIds: string[] = [];
      if (kelas_nama === "-") {
        // Orphan students: UI treats profiles without a role as SISWA fallback,
        // so include real SISWA and role-less profiles that have no kelas.
        const [{ data: profiles }, { data: roles }] = await Promise.all([
          supabaseAdmin.from("profiles").select("user_id"),
          supabaseAdmin.from("user_roles").select("user_id, role"),
        ]);
        const roleByUser = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
        const studentLikeIds = (profiles || [])
          .map((p: any) => p.user_id)
          .filter((id: string) => !roleByUser.has(id) || roleByUser.get(id) === "SISWA");
        if (studentLikeIds.length === 0) {
          return new Response(JSON.stringify({ success: true, count: 0 }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: withKelas } = await supabaseAdmin.from("user_kelas").select("user_id").in("user_id", studentLikeIds);
        const withKelasSet = new Set((withKelas || []).map((r: any) => r.user_id));
        studentIds = studentLikeIds.filter((id: string) => !withKelasSet.has(id));
      } else {
        const { data: kelasRow } = await supabaseAdmin.from("kelas").select("id").eq("nama", kelas_nama).maybeSingle();
        if (!kelasRow) {
          return new Response(JSON.stringify({ error: "Kelas tidak ditemukan" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: userKelasRows } = await supabaseAdmin.from("user_kelas").select("user_id").eq("kelas_id", kelasRow.id);
        const candidateIds = (userKelasRows || []).map((r: any) => r.user_id);
        if (candidateIds.length > 0) {
          const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", candidateIds);
          const roleByUser = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
          studentIds = candidateIds.filter((id: string) => !roleByUser.has(id) || roleByUser.get(id) === "SISWA");
        }
      }
      if (studentIds.length > 0) {
        if (action === "delete-users-by-kelas" || action === "restore-users-by-kelas") {
          // Hanya proses akun yang sudah diarsipkan
          const { data: archivedProfiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .in("user_id", studentIds)
            .not("archived_at", "is", null);
          studentIds = (archivedProfiles || []).map((p: any) => p.user_id);
        } else if (action === "archive-users-by-kelas") {
          // Hanya proses akun yang BELUM diarsipkan
          const { data: activeProfiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .in("user_id", studentIds)
            .is("archived_at", null);
          studentIds = (activeProfiles || []).map((p: any) => p.user_id);
        }
      }
      if (studentIds.length === 0) {
        return new Response(JSON.stringify({ success: true, count: 0 }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "archive-users-by-kelas") {
        await supabaseAdmin.from("profiles")
          .update({ archived_at: new Date().toISOString(), archived_by: caller.id })
          .in("user_id", studentIds);
        const SIGNOUT_BATCH = 20;
        for (let i = 0; i < studentIds.length; i += SIGNOUT_BATCH) {
          const batch = studentIds.slice(i, i + SIGNOUT_BATCH);
          await Promise.all(batch.map((sid: string) =>
            supabaseAdmin.auth.admin.signOut(sid).catch(() => {})
          ));
        }
        await auditLog({ target_role: "SISWA", op: "archive-bulk-kelas", kelas: kelas_nama, count: studentIds.length });
      } else if (action === "restore-users-by-kelas") {
        await supabaseAdmin.from("profiles")
          .update({ archived_at: null, archived_by: null })
          .in("user_id", studentIds);
        await auditLog({ target_role: "SISWA", op: "restore-bulk-kelas", kelas: kelas_nama, count: studentIds.length });
      } else {
        await Promise.all([
          supabaseAdmin.from("scores").delete().in("student_id", studentIds),
          supabaseAdmin.from("scores").update({ created_by: null }).in("created_by", studentIds),
          supabaseAdmin.from("user_kelas").delete().in("user_id", studentIds),
          supabaseAdmin.from("user_mapel").delete().in("user_id", studentIds),
          supabaseAdmin.from("user_roles").delete().in("user_id", studentIds),
          supabaseAdmin.from("profiles").delete().in("user_id", studentIds),
        ]);

        const AUTH_BATCH = 20;
        for (let i = 0; i < studentIds.length; i += AUTH_BATCH) {
          const batch = studentIds.slice(i, i + AUTH_BATCH);
          await Promise.all(batch.map((uid: string) => supabaseAdmin.auth.admin.deleteUser(uid)));
        }
        await auditLog({ target_role: "SISWA", op: "delete-bulk-kelas", kelas: kelas_nama, count: studentIds.length });
      }
      return new Response(JSON.stringify({ success: true, count: studentIds.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "archive-users-by-role" || action === "restore-users-by-role" || action === "delete-archived-users-by-role") {
      const { role } = payload;
      if (!role || !["GURU", "SISWA"].includes(role)) {
        return new Response(JSON.stringify({ error: "Role tidak valid" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleUsers } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", role);
      let userIds = (roleUsers || []).map((ru: any) => ru.user_id);
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ success: true, count: 0 }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "delete-archived-users-by-role" || action === "restore-users-by-role") {
        const { data: archivedProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .in("user_id", userIds)
          .not("archived_at", "is", null);
        userIds = (archivedProfiles || []).map((p: any) => p.user_id);
        if (userIds.length === 0) {
          return new Response(JSON.stringify({ success: true, count: 0 }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (action === "archive-users-by-role") {
        const { data: activeProfiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .in("user_id", userIds)
          .is("archived_at", null);
        userIds = (activeProfiles || []).map((p: any) => p.user_id);
        if (userIds.length === 0) {
          return new Response(JSON.stringify({ success: true, count: 0 }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      if (action === "archive-users-by-role") {
        await supabaseAdmin.from("profiles")
          .update({ archived_at: new Date().toISOString(), archived_by: caller.id })
          .in("user_id", userIds);
        const SIGNOUT_BATCH = 20;
        for (let i = 0; i < userIds.length; i += SIGNOUT_BATCH) {
          const batch = userIds.slice(i, i + SIGNOUT_BATCH);
          await Promise.all(batch.map((uid: string) =>
            supabaseAdmin.auth.admin.signOut(uid).catch(() => {})
          ));
        }
        await auditLog({ target_role: role, op: "archive-bulk-role", count: userIds.length });
      } else if (action === "restore-users-by-role") {
        await supabaseAdmin.from("profiles")
          .update({ archived_at: null, archived_by: null })
          .in("user_id", userIds);
        await auditLog({ target_role: role, op: "restore-bulk-role", count: userIds.length });
      } else {
        await Promise.all([
          supabaseAdmin.from("scores").delete().in("student_id", userIds),
          supabaseAdmin.from("scores").update({ created_by: null }).in("created_by", userIds),
          supabaseAdmin.from("user_kelas").delete().in("user_id", userIds),
          supabaseAdmin.from("user_mapel").delete().in("user_id", userIds),
          supabaseAdmin.from("user_roles").delete().in("user_id", userIds),
          supabaseAdmin.from("profiles").delete().in("user_id", userIds),
        ]);
        const AUTH_BATCH = 20;
        for (let i = 0; i < userIds.length; i += AUTH_BATCH) {
          const batch = userIds.slice(i, i + AUTH_BATCH);
          await Promise.all(batch.map((uid: string) => supabaseAdmin.auth.admin.deleteUser(uid)));
        }
        await auditLog({ target_role: role, op: "delete-bulk-role", count: userIds.length });
      }
      return new Response(JSON.stringify({ success: true, count: userIds.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Terjadi kesalahan server" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
