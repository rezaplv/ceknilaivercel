import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/contexts/AuthContext";

export interface DbUser {
  user_id: string;
  username: string;
  nama_lengkap: string;
  role: UserRole;
  kelas: string[];
  mapel: string[];
  /** Untuk SISWA: mapel gabungan (milik sendiri + yang diajarkan guru di kelasnya) */
  mapel_efektif?: string[];
  archived_at?: string | null;
}

export async function fetchCurrentUserProfile(knownUserId?: string): Promise<DbUser | null> {
  let userId = knownUserId;
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id;
  }
  if (!userId) return null;

  const [
    { data: profile },
    { data: roleData },
    { data: userKelas },
    { data: userMapel },
  ] = await Promise.all([
    (supabase.from("profiles") as any).select("username, nama_lengkap, archived_at").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("user_kelas").select("kelas_id, kelas(nama)").eq("user_id", userId),
    supabase.from("user_mapel").select("mapel_id, mapel(nama)").eq("user_id", userId),
  ]);

  if (!profile || !roleData) return null;
  // Block archived (soft-deleted) accounts from logging in
  if ((profile as any).archived_at) {
    await supabase.auth.signOut();
    return null;
  }

  const role = roleData.role as UserRole;
  let mapel = (userMapel || []).map((um: any) => um.mapel?.nama).filter(Boolean);
  const kelas = (userKelas || []).map((uk: any) => uk.kelas?.nama).filter(Boolean);

  // Untuk SISWA: daftar mapel ditarik dari mapel yang diajarkan GURU di kelas mereka,
  // sehingga otomatis terupdate saat admin menambah guru baru pada kelas tersebut.
  if (role === "SISWA") {
    const kelasIds = (userKelas || []).map((uk: any) => uk.kelas_id).filter(Boolean);
    if (kelasIds.length > 0) {
      const { data: kelasMembers } = await supabase
        .from("user_kelas").select("user_id").in("kelas_id", kelasIds);
      const memberIds = [...new Set((kelasMembers || []).map((r: any) => r.user_id))]
        .filter((id) => id !== userId);
      if (memberIds.length > 0) {
        const { data: guruRoles } = await supabase
          .from("user_roles").select("user_id").eq("role", "GURU").in("user_id", memberIds);
        const guruIds = (guruRoles || []).map((r: any) => r.user_id);
        if (guruIds.length > 0) {
          const { data: guruMapel } = await supabase
            .from("user_mapel").select("mapel(nama)").in("user_id", guruIds);
          const taught = (guruMapel || [])
            .map((um: any) => um.mapel?.nama)
            .filter(Boolean);
          mapel = [...new Set([...mapel, ...taught])].sort((a: string, b: string) =>
            a.localeCompare(b, "id", { numeric: true, sensitivity: "base" })
          );
        }
      }
    }
  }

  return {
    user_id: userId,
    username: profile.username,
    nama_lengkap: profile.nama_lengkap,
    role,
    kelas,
    mapel,
  };
}

export async function fetchAllUsers(includeArchived = false): Promise<DbUser[]> {
  const profilesQuery: any = supabase.from("profiles").select("user_id, username, nama_lengkap, archived_at" as any);
  if (!includeArchived) profilesQuery.is("archived_at", null);
  const [
    { data: profiles },
    { data: roles },
    { data: allUserKelas },
    { data: allUserMapel },
  ] = await Promise.all([
    profilesQuery,
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("user_kelas").select("user_id, kelas(nama)"),
    supabase.from("user_mapel").select("user_id, mapel(nama)"),
  ]);

  if (!profiles) return [];

  // Mapel yang diajarkan GURU per nama kelas -> dipakai sebagai mapel efektif siswa
  const guruIds = new Set((roles || []).filter((r: any) => r.role === "GURU").map((r: any) => r.user_id));
  const mapelByUser = new Map<string, string[]>();
  (allUserMapel || []).forEach((um: any) => {
    const nama = um.mapel?.nama;
    if (!nama) return;
    const arr = mapelByUser.get(um.user_id) || [];
    arr.push(nama);
    mapelByUser.set(um.user_id, arr);
  });
  const taughtByKelas = new Map<string, Set<string>>();
  (allUserKelas || []).forEach((uk: any) => {
    const kelasNama = uk.kelas?.nama;
    if (!kelasNama || !guruIds.has(uk.user_id)) return;
    const set = taughtByKelas.get(kelasNama) || new Set<string>();
    (mapelByUser.get(uk.user_id) || []).forEach((m) => set.add(m));
    taughtByKelas.set(kelasNama, set);
  });

  return profiles.map((p: any) => {
    const role = roles?.find((r: any) => r.user_id === p.user_id);
    const kelas = (allUserKelas || [])
      .filter((uk: any) => uk.user_id === p.user_id)
      .map((uk: any) => uk.kelas?.nama)
      .filter(Boolean);
    const mapel = mapelByUser.get(p.user_id) || [];
    const roleName = (role?.role || "SISWA") as UserRole;

    let mapelEfektif = mapel;
    if (roleName === "SISWA") {
      const merged = new Set<string>(mapel);
      kelas.forEach((k: string) => (taughtByKelas.get(k) || new Set<string>()).forEach((m) => merged.add(m)));
      mapelEfektif = Array.from(merged).sort((a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" }));
    }

    return {
      user_id: p.user_id,
      username: p.username,
      nama_lengkap: p.nama_lengkap,
      role: roleName,
      kelas,
      mapel,
      mapel_efektif: mapelEfektif,
      archived_at: p.archived_at || null,
    } as DbUser;
  });
}

// ---- Cache ringan untuk data master (kelas/mapel/settings) ----
const TTL = 60_000;
type CacheEntry = { at: number; data: any };
const _cache = new Map<string, CacheEntry>();
const _inflight = new Map<string, Promise<any>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data as T);
  const running = _inflight.get(key);
  if (running) return running as Promise<T>;
  const p = loader()
    .then((data) => { _cache.set(key, { at: Date.now(), data }); return data; })
    .finally(() => { _inflight.delete(key); });
  _inflight.set(key, p);
  return p;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { _cache.clear(); return; }
  for (const k of Array.from(_cache.keys())) if (k.startsWith(prefix)) _cache.delete(k);
}

export async function fetchKelasList(includeArchived = false): Promise<{ id: string; nama: string; archived_at?: string | null }[]> {
  const rows = await cached("kelas", async () => {
    const { data } = await supabase.from("kelas").select("id, nama, archived_at").order("nama");
    return (data || []) as any[];
  });
  return includeArchived ? rows : rows.filter((r: any) => !r.archived_at);
}

export async function fetchMapelList(includeArchived = false): Promise<{ id: string; nama: string; archived_at?: string | null }[]> {
  const rows = await cached("mapel", async () => {
    const { data } = await supabase.from("mapel").select("id, nama, archived_at").order("nama");
    return (data || []) as any[];
  });
  return includeArchived ? rows : rows.filter((r: any) => !r.archived_at);
}

export async function insertKelas(nama: string) {
  const { error } = await supabase.from("kelas").insert({ nama });
  if (error) throw error;
  invalidateCache("kelas");
}

export async function archiveKelas(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("kelas").update({ archived_at: new Date().toISOString(), archived_by: u.user?.id ?? null } as any).eq("id", id);
  if (error) throw error;
  invalidateCache("kelas");
}

export async function restoreKelas(id: string) {
  const { error } = await supabase.from("kelas").update({ archived_at: null, archived_by: null } as any).eq("id", id);
  if (error) throw error;
  invalidateCache("kelas");
}

export async function deleteKelas(id: string) {
  const { error } = await supabase.from("kelas").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("kelas");
}

export async function insertMapel(nama: string) {
  const { error } = await supabase.from("mapel").insert({ nama });
  if (error) throw error;
  invalidateCache("mapel");
}

export async function archiveMapel(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("mapel").update({ archived_at: new Date().toISOString(), archived_by: u.user?.id ?? null } as any).eq("id", id);
  if (error) throw error;
  invalidateCache("mapel");
}

export async function restoreMapel(id: string) {
  const { error } = await supabase.from("mapel").update({ archived_at: null, archived_by: null } as any).eq("id", id);
  if (error) throw error;
  invalidateCache("mapel");
}

export async function deleteMapel(id: string) {
  const { error } = await supabase.from("mapel").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("mapel");
}

export async function fetchSettings(): Promise<Record<string, string>> {
  return cached("settings", async () => {
    const { data } = await supabase.from("settings").select("key, value");
    const settings: Record<string, string> = {};
    (data || []).forEach((s: any) => { settings[s.key] = s.value; });
    return settings;
  });
}

export async function updateSetting(key: string, value: string) {
  await supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
  invalidateCache("settings");
}


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function callManageUsers(action: string, payload: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export async function fetchScores(filters?: { kelas_id?: string; mapel_id?: string; student_id?: string }) {
  let query = supabase.from("scores").select("*, kelas(nama), mapel(nama)");
  if (filters?.kelas_id) query = query.eq("kelas_id", filters.kelas_id);
  if (filters?.mapel_id) query = query.eq("mapel_id", filters.mapel_id);
  if (filters?.student_id) query = query.eq("student_id", filters.student_id);
  const { data } = await query;
  return data || [];
}

/**
 * Tandai pasangan kelas+mapel ke antrian backup Google Drive.
 * Aman dipanggil sesering apapun: UNIQUE(kelas_id,mapel_id) + onConflict.
 * Tidak melempar error agar tidak menggangu flow utama.
 */
export async function enqueueBackup(kelasId: string, mapelId: string) {
  if (!kelasId || !mapelId) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("backup_queue") as any)
      .upsert(
        { kelas_id: kelasId, mapel_id: mapelId, queued_by: user?.id ?? null, queued_at: new Date().toISOString(), attempts: 0, last_error: null },
        { onConflict: "kelas_id,mapel_id" },
      );
    // Langsung trigger Edge Function backup di background agar tersimpan ke Drive saat itu juga
    void supabase.functions.invoke("backup-rekap-drive", { body: {} });
  } catch (e) {
    console.warn("enqueueBackup gagal (diabaikan):", e);
  }
}

function uniquePairs(entries: any[]): { kelas_id: string; mapel_id: string }[] {
  const set = new Set<string>();
  const out: { kelas_id: string; mapel_id: string }[] = [];
  for (const e of entries) {
    const k = `${e.kelas_id}|${e.mapel_id}`;
    if (!set.has(k)) { set.add(k); out.push({ kelas_id: e.kelas_id, mapel_id: e.mapel_id }); }
  }
  return out;
}

export async function insertScores(entries: any[]) {
  // Group by unique combination and delete in parallel
  const deleteKeys = new Map<string, any>();
  for (const entry of entries) {
    const key = `${entry.student_id}|${entry.kelas_id}|${entry.mapel_id}|${entry.jenis}|${entry.nama_penilaian}`;
    if (!deleteKeys.has(key)) deleteKeys.set(key, entry);
  }
  await Promise.all(
    Array.from(deleteKeys.values()).map(entry =>
      supabase.from("scores").delete()
        .eq("student_id", entry.student_id)
        .eq("kelas_id", entry.kelas_id)
        .eq("mapel_id", entry.mapel_id)
        .eq("jenis", entry.jenis)
        .eq("nama_penilaian", entry.nama_penilaian)
    )
  );
  const { error } = await supabase.from("scores").insert(entries);
  if (error) throw error;
  // Enqueue backup untuk setiap pasangan kelas+mapel yang tersentuh
  // Fire-and-forget agar UI tidak menunggu antrean backup
  void Promise.all(uniquePairs(entries).map(p => enqueueBackup(p.kelas_id, p.mapel_id)));
}

export async function updateScoreVisibility(scoreId: string, visible: boolean) {
  await supabase.from("scores").update({ visible }).eq("id", scoreId);
  // Enqueue backup di latar belakang (tidak memblokir UI)
  void (async () => {
    const { data } = await supabase.from("scores").select("kelas_id, mapel_id").eq("id", scoreId).maybeSingle();
    if (data) await enqueueBackup(data.kelas_id, data.mapel_id);
  })();
}

export async function updateScoreValue(scoreId: string, nilai: number, nilaiAsli?: number | null) {
  const updateData: any = { nilai };
  if (nilaiAsli !== undefined) updateData.nilai_asli = nilaiAsli;
  const { error } = await supabase.from("scores").update(updateData).eq("id", scoreId);
  if (error) throw error;
  void (async () => {
    const { data } = await supabase.from("scores").select("kelas_id, mapel_id").eq("id", scoreId).maybeSingle();
    if (data) await enqueueBackup(data.kelas_id, data.mapel_id);
  })();
}

export async function renameNamaPenilaian(kelasId: string, mapelId: string, jenis: string, oldName: string, newName: string) {
  const { error } = await supabase.from("scores").update({ nama_penilaian: newName })
    .eq("kelas_id", kelasId).eq("mapel_id", mapelId).eq("jenis", jenis).eq("nama_penilaian", oldName);
  if (error) throw error;
  void enqueueBackup(kelasId, mapelId);
}

export async function deleteScoresByJenis(kelasId: string, mapelId: string, jenis: string, namaPenilaian?: string) {
  let query = supabase.from("scores").delete().eq("kelas_id", kelasId).eq("mapel_id", mapelId).eq("jenis", jenis);
  if (namaPenilaian) query = query.eq("nama_penilaian", namaPenilaian);
  const { error } = await query;
  if (error) throw error;
  void enqueueBackup(kelasId, mapelId);
}

export async function fetchBroadcasts() {
  const { data, error } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchBroadcasts error:", error); return []; }
  if (!data || data.length === 0) return [];

  // Manually resolve creator usernames (no FK on created_by)
  const creatorIds = [...new Set(data.map((b: any) => b.created_by).filter(Boolean))];
  const [{ data: profiles }, kelasMap, mapelMap] = await Promise.all([
    creatorIds.length > 0
      ? supabase.from("profiles").select("user_id, username").in("user_id", creatorIds)
      : Promise.resolve({ data: [] }),
    resolveKelasNames(data),
    resolveMapelNames(data),
  ]);
  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.username; });

  return data.map((b: any) => ({
    ...b,
    profiles: { username: profileMap[b.created_by] || "unknown" },
    target_kelas_names: (b.target_kelas || []).map((id: string) => kelasMap[id] || id),
    target_mapel_names: (b.target_mapel || []).map((id: string) => mapelMap[id] || id),
  }));
}

async function resolveKelasNames(data: any[]): Promise<Record<string, string>> {
  const ids = [...new Set(data.flatMap((b: any) => b.target_kelas || []))];
  if (ids.length === 0) return {};
  const { data: rows } = await supabase.from("kelas").select("id, nama").in("id", ids);
  const m: Record<string, string> = {};
  (rows || []).forEach((k: any) => { m[k.id] = k.nama; });
  return m;
}

async function resolveMapelNames(data: any[]): Promise<Record<string, string>> {
  const ids = [...new Set(data.flatMap((b: any) => b.target_mapel || []))];
  if (ids.length === 0) return {};
  const { data: rows } = await supabase.from("mapel").select("id, nama").in("id", ids);
  const m: Record<string, string> = {};
  (rows || []).forEach((k: any) => { m[k.id] = k.nama; });
  return m;
}

export async function fetchTeacherBroadcasts() {
  // Hanya ambil broadcast yang dibuat oleh ADMIN
  const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "ADMIN");
  const adminIds = (adminRoles || []).map((r: any) => r.user_id);
  if (adminIds.length === 0) return [];

  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .in("created_by", adminIds)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchTeacherBroadcasts error:", error); return []; }
  if (!data || data.length === 0) return [];

  const [kelasMap, mapelMap] = await Promise.all([
    resolveKelasNames(data),
    resolveMapelNames(data),
  ]);
  return data.map((b: any) => ({
    ...b,
    target_kelas_names: (b.target_kelas || []).map((id: string) => kelasMap[id] || id),
    target_mapel_names: (b.target_mapel || []).map((id: string) => mapelMap[id] || id),
  }));
}

export async function fetchStudentBroadcasts() {
  const { data, error } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchStudentBroadcasts error:", error); return []; }
  if (!data || data.length === 0) return [];

  const [kelasMap, mapelMap] = await Promise.all([
    resolveKelasNames(data),
    resolveMapelNames(data),
  ]);
  return data.map((b: any) => ({
    ...b,
    target_kelas_names: (b.target_kelas || []).map((id: string) => kelasMap[id] || id),
    target_mapel_names: (b.target_mapel || []).map((id: string) => mapelMap[id] || id),
  }));
}

export async function insertBroadcast(broadcast: { title: string; message: string; target_kelas: string[]; target_mapel: string[]; target_role: string[]; created_by: string }) {
  const { error } = await supabase.from("broadcasts").insert(broadcast);
  if (error) throw error;
}

export async function deleteBroadcast(id: string) {
  await supabase.from("broadcasts").delete().eq("id", id);
}

export async function fetchRecentAuditLogs(limit = 10) {
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return [];

  // Manually resolve performer usernames since there's no FK
  const performerIds = [...new Set(data.map((d: any) => d.performed_by))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", performerIds);

  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.username; });

  return data.map((log: any) => ({
    ...log,
    profiles: { username: profileMap[log.performed_by] || "system" },
  }));
}



// Get students in a specific kelas
export async function fetchStudentsByKelas(kelasNama: string): Promise<DbUser[]> {
  // Get kelas id
  const { data: kelasData } = await supabase.from("kelas").select("id").eq("nama", kelasNama).maybeSingle();
  if (!kelasData) return [];

  // Get user_ids in this kelas
  const { data: userKelasData } = await supabase.from("user_kelas").select("user_id").eq("kelas_id", kelasData.id);
  if (!userKelasData || userKelasData.length === 0) return [];

  const userIds = userKelasData.map((uk: any) => uk.user_id);

  // Filter only SISWA
  const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "SISWA").in("user_id", userIds);
  if (!studentRoles || studentRoles.length === 0) return [];

  const studentIds = studentRoles.map((sr: any) => sr.user_id);

  const { data: profiles } = await (supabase.from("profiles") as any)
    .select("user_id, username, nama_lengkap, archived_at")
    .in("user_id", studentIds)
    .is("archived_at", null);
  if (!profiles) return [];

  return profiles.map((p: any) => ({
    user_id: p.user_id,
    username: p.username,
    nama_lengkap: p.nama_lengkap,
    role: "SISWA" as UserRole,
    kelas: [kelasNama],
    mapel: [],
  }));
}

// ===== ARCHIVE / RECOVERY =====

// Archive a student account (ADMIN only). Soft-delete via edge function.
export async function archiveUser(userId: string) {
  return await callManageUsers("archive-user", { user_id: userId });
}

export async function restoreUser(userId: string) {
  return await callManageUsers("restore-user", { user_id: userId });
}

export async function archiveUsersByKelas(kelasNama: string) {
  return await callManageUsers("archive-users-by-kelas", { kelas_nama: kelasNama });
}

export async function restoreUsersByKelas(kelasNama: string) {
  return await callManageUsers("restore-users-by-kelas", { kelas_nama: kelasNama });
}

export async function archiveUsersByRole(role: string) {
  return await callManageUsers("archive-users-by-role", { role });
}

export async function restoreUsersByRole(role: string) {
  return await callManageUsers("restore-users-by-role", { role });
}

export async function deleteArchivedUsersByRole(role: string) {
  return await callManageUsers("delete-archived-users-by-role", { role });
}

export async function deleteUsersByKelas(kelasNama: string) {
  return await callManageUsers("delete-users-by-kelas", { kelas_nama: kelasNama });
}

// Snapshot scores into deleted_scores_archive before bulk delete (per kelas+mapel+jenis)
export async function snapshotAndDeleteScoresByJenis(
  kelasId: string,
  mapelId: string,
  jenis: string,
  namaPenilaian: string | undefined,
  context: "rekap_bulk" | "rekap_single",
) {
  let q = supabase.from("scores").select("*")
    .eq("kelas_id", kelasId).eq("mapel_id", mapelId).eq("jenis", jenis);
  if (namaPenilaian) q = q.eq("nama_penilaian", namaPenilaian);
  const { data: rows, error: selErr } = await q;
  if (selErr) throw selErr;
  if (rows && rows.length > 0) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid) {
      await (supabase.from("deleted_scores_archive") as any).insert({
        deleted_by: uid,
        context,
        kelas_id: kelasId,
        mapel_id: mapelId,
        jenis,
        nama_penilaian: namaPenilaian || null,
        payload: rows,
        note: `${rows.length} baris nilai`,
      });
    }
  }
  await deleteScoresByJenis(kelasId, mapelId, jenis, namaPenilaian);
  return rows?.length || 0;
}

export async function fetchScoreArchive() {
  const { data, error } = await (supabase.from("deleted_scores_archive") as any)
    .select("*")
    .order("deleted_at", { ascending: false });
  if (error) return [];
  // Resolve names
  const kelasIds = [...new Set((data || []).map((d: any) => d.kelas_id).filter(Boolean))];
  const mapelIds = [...new Set((data || []).map((d: any) => d.mapel_id).filter(Boolean))];
  const userIds = [...new Set((data || []).map((d: any) => d.deleted_by).filter(Boolean))];
  const [{ data: kelas }, { data: mapel }, { data: profiles }] = await Promise.all([
    kelasIds.length ? supabase.from("kelas").select("id, nama").in("id", kelasIds as string[]) : Promise.resolve({ data: [] }),
    mapelIds.length ? supabase.from("mapel").select("id, nama").in("id", mapelIds as string[]) : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("user_id, nama_lengkap, username").in("user_id", userIds as string[]) : Promise.resolve({ data: [] }),
  ]);
  const km: Record<string, string> = {}; (kelas || []).forEach((k: any) => { km[k.id] = k.nama; });
  const mm: Record<string, string> = {}; (mapel || []).forEach((m: any) => { mm[m.id] = m.nama; });
  const pm: Record<string, string> = {}; (profiles || []).forEach((p: any) => { pm[p.user_id] = p.nama_lengkap || p.username; });
  return (data || []).map((d: any) => ({
    ...d,
    kelas_nama: km[d.kelas_id] || "-",
    mapel_nama: mm[d.mapel_id] || "-",
    deleted_by_nama: pm[d.deleted_by] || "?",
  }));
}

export async function restoreScoreArchive(archiveId: string) {
  const { data: row, error } = await (supabase.from("deleted_scores_archive") as any)
    .select("*").eq("id", archiveId).maybeSingle();
  if (error || !row) throw error || new Error("Arsip tidak ditemukan");
  const payload = row.payload as any[];
  if (!Array.isArray(payload) || payload.length === 0) {
    await (supabase.from("deleted_scores_archive") as any).delete().eq("id", archiveId);
    return 0;
  }
  // Strip ids so re-insert generates new ones; keep all other fields
  const toInsert = payload.map((r: any) => {
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = r;
    return rest;
  });
  const { error: insErr } = await supabase.from("scores").insert(toInsert);
  if (insErr) throw insErr;
  await (supabase.from("deleted_scores_archive") as any).delete().eq("id", archiveId);
  return toInsert.length;
}

export async function purgeScoreArchive(archiveId: string) {
  await (supabase.from("deleted_scores_archive") as any).delete().eq("id", archiveId);
}
