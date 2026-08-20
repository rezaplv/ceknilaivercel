// Backup Rekap Nilai (view ALL) ke Google Drive via Google Apps Script Web App / Service Account.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function sanitize(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function buildExcelBuffer(args: {
  kelas: string; mapel: string; guru: string; semester: string; tahunAjaran: string;
  students: { id: string; nama: string }[];
  scores: any[];
  formatifNames: string[];
  sumatifNames: string[];
}): Uint8Array {
  const { kelas, mapel, guru, semester, tahunAjaran, students, scores, formatifNames, sumatifNames } = args;

  const getScore = (sid: string, jenis: string, nama?: string) =>
    scores.find((s) => s.student_id === sid && s.jenis === jenis && (nama ? s.nama_penilaian === nama : true));
  const getScoresFor = (sid: string, jenis: string) =>
    scores.filter((s) => s.student_id === sid && s.jenis === jenis && s.nilai_type === "angka");
  const avg = (n: number[]) => n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;

  const rows = students.map((st, i) => {
    const fS = getScoresFor(st.id, "FORMATIF");
    const sS = getScoresFor(st.id, "SUMATIF");
    const aF = avg(fS.map((s: any) => Number(s.nilai)));
    const aS = avg(sS.map((s: any) => Number(s.nilai)));
    const stsE = getScore(st.id, "STS");
    const sasE = getScore(st.id, "SAS");
    const sts = stsE ? Number(stsE.nilai) : null;
    const sas = sasE ? Number(sasE.nilai) : null;
    const f = aF ?? 0, s = aS ?? 0;
    const stN = (sts !== null && sts >= 0) ? sts : 0;
    const saNVal = (sas !== null && sas >= 0) ? sas : 0;
    const na = (2 * f + 2 * s + stN + saNVal) / 6;

    const row: any[] = [i + 1, st.nama];
    formatifNames.forEach((n) => {
      const e = getScore(st.id, "FORMATIF", n);
      row.push(e ? Number(e.nilai) : "");
    });
    if (formatifNames.length > 1) row.push(aF !== null ? Math.round(aF * 10) / 10 : "");
    sumatifNames.forEach((n) => {
      const e = getScore(st.id, "SUMATIF", n);
      row.push(e ? Number(e.nilai) : "");
    });
    if (sumatifNames.length >= 1) row.push(aS !== null ? Math.round(aS * 10) / 10 : "");
    row.push(sts !== null ? sts : "");
    row.push(sas !== null ? sas : "");
    row.push(Math.round(na * 10) / 10);
    return row;
  });

  let totalCols = 2 + formatifNames.length + (formatifNames.length > 1 ? 1 : 0)
    + sumatifNames.length + (sumatifNames.length >= 1 ? 1 : 0) + 3;

  const wsData: any[][] = [];
  wsData.push(["DAFTAR NILAI"]);
  wsData.push([]);
  wsData.push(["KELAS", "", `: ${kelas}`, "", "", "", "", "", "", "SEMESTER", "", `: ${semester}`]);
  wsData.push(["MATA PELAJARAN", "", `: ${mapel}`, "", "", "", "", "", "", "TAHUN PELAJARAN", "", `: ${tahunAjaran}`]);
  wsData.push(["GURU", "", `: ${guru}`]);
  wsData.push([]);

  const h1: any[] = ["NO", "NAMA"];
  for (let i = 0; i < formatifNames.length; i++) h1.push(i === 0 ? "TUGAS (FORMATIF)" : "");
  if (formatifNames.length > 1) h1.push("RERATA");
  for (let i = 0; i < sumatifNames.length; i++) h1.push(i === 0 ? "UL. HARIAN (SUMATIF)" : "");
  if (sumatifNames.length >= 1) h1.push("RERATA");
  h1.push("STS"); h1.push("SAS"); h1.push("NA");
  wsData.push(h1);

  const h2: any[] = ["", ""];
  formatifNames.forEach((n) => h2.push(n));
  if (formatifNames.length > 1) h2.push("TUGAS");
  sumatifNames.forEach((n) => h2.push(n));
  if (sumatifNames.length >= 1) h2.push("UL. HARIAN");
  h2.push(""); h2.push(""); h2.push("");
  wsData.push(h2);

  rows.forEach((r) => wsData.push(r));

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(totalCols - 1, 0) } }];
  if (formatifNames.length > 1) {
    ws["!merges"].push({ s: { r: 6, c: 2 }, e: { r: 6, c: 2 + formatifNames.length - 1 } });
  }
  if (sumatifNames.length > 1) {
    let sStart = 2 + formatifNames.length + (formatifNames.length > 1 ? 1 : 0);
    ws["!merges"].push({ s: { r: 6, c: sStart }, e: { r: 6, c: sStart + sumatifNames.length - 1 } });
  }
  const colWidths: any[] = [{ wch: 5 }, { wch: 35 }];
  for (let i = 2; i < totalCols; i++) colWidths.push({ wch: 14 });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

async function uploadViaWebApp(webAppUrl: string, kelasNama: string, mapelNama: string, buf: Uint8Array) {
  const fileName = `Rekap_${sanitize(kelasNama)}_${sanitize(mapelNama)}_ALL.xlsx`;
  const base64 = uint8ArrayToBase64(buf);

  const res = await fetch(webAppUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderName: "CekNilai Backup",
      subFolder: sanitize(kelasNama),
      fileName,
      fileBase64: base64,
    }),
    redirect: "follow",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Apps Script error [${res.status}]: ${txt}`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Google Apps Script error: ${json.error || "Gagal menyimpan file"}`);
  }

  return { id: json.fileId || "webapp-file", fileName: json.fileName || fileName };
}

async function processOne(webAppUrl: string, supa: any, item: any) {
  const t0 = Date.now();
  const { kelas_id, mapel_id } = item;

  const [{ data: kelasRow }, { data: mapelRow }] = await Promise.all([
    supa.from("kelas").select("nama").eq("id", kelas_id).maybeSingle(),
    supa.from("mapel").select("nama").eq("id", mapel_id).maybeSingle(),
  ]);
  if (!kelasRow || !mapelRow) {
    throw new Error(`Kelas/Mapel tidak ditemukan (${kelas_id}/${mapel_id})`);
  }
  const kelasNama = kelasRow.nama, mapelNama = mapelRow.nama;

  const { data: ukRows } = await supa.from("user_kelas").select("user_id").eq("kelas_id", kelas_id);
  const studentIds = (ukRows ?? []).map((r: any) => r.user_id);
  if (studentIds.length === 0) {
    return { kelasNama, mapelNama, fileId: null, fileName: null, skipped: true, ms: Date.now() - t0 };
  }
  const { data: roleRows } = await supa.from("user_roles").select("user_id").in("user_id", studentIds).eq("role", "SISWA");
  const siswaIds = (roleRows ?? []).map((r: any) => r.user_id);
  if (siswaIds.length === 0) {
    return { kelasNama, mapelNama, fileId: null, fileName: null, skipped: true, ms: Date.now() - t0 };
  }
  const { data: profileRows } = await supa.from("profiles").select("user_id, nama_lengkap").in("user_id", siswaIds);
  const students = (profileRows ?? [])
    .map((p: any) => ({ id: p.user_id, nama: p.nama_lengkap }))
    .sort((a: any, b: any) => a.nama.localeCompare(b.nama));

  const { data: scoresRows } = await supa.from("scores").select("*").eq("kelas_id", kelas_id).eq("mapel_id", mapel_id);
  const scores = scoresRows ?? [];

  const { data: umRows } = await supa.from("user_mapel").select("user_id").eq("mapel_id", mapel_id);
  const teacherIds = (umRows ?? []).map((r: any) => r.user_id);
  const { data: ukGRows } = await supa.from("user_kelas").select("user_id").eq("kelas_id", kelas_id).in("user_id", teacherIds);
  const guruIds = (ukGRows ?? []).map((r: any) => r.user_id);
  let guruNama = "-";
  if (guruIds.length > 0) {
    const { data: gp } = await supa.from("profiles").select("nama_lengkap").in("user_id", guruIds).limit(1).maybeSingle();
    if (gp) guruNama = gp.nama_lengkap;
  }

  const { data: setRows } = await supa.from("settings").select("key, value").in("key", ["semester", "tahun_ajaran"]);
  const settingsMap: Record<string, string> = {};
  (setRows ?? []).forEach((s: any) => { settingsMap[s.key] = s.value; });

  const formatifNames = Array.from(new Set(scores.filter((s: any) => s.jenis === "FORMATIF").map((s: any) => s.nama_penilaian))).sort();
  const sumatifNames = Array.from(new Set(scores.filter((s: any) => s.jenis === "SUMATIF").map((s: any) => s.nama_penilaian))).sort();

  const buf = buildExcelBuffer({
    kelas: kelasNama, mapel: mapelNama, guru: guruNama,
    semester: settingsMap["semester"] ?? "-",
    tahunAjaran: settingsMap["tahun_ajaran"] ?? "-",
    students, scores,
    formatifNames: formatifNames as string[],
    sumatifNames: sumatifNames as string[],
  });

  const { id: fileId, fileName } = await uploadViaWebApp(webAppUrl, kelasNama, mapelNama, buf);

  return { kelasNama, mapelNama, fileId, fileName, skipped: false, ms: Date.now() - t0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: any = { processed: 0, succeeded: 0, failed: 0, skipped: 0, items: [] };

  try {
    const webAppUrl = Deno.env.get("GOOGLE_DRIVE_WEBAPP_URL");
    if (!webAppUrl) {
      throw new Error("Secret GOOGLE_DRIVE_WEBAPP_URL belum dikonfigurasi di Supabase Edge Function Secrets.");
    }

    const { data: queue, error: qErr } = await supa.from("backup_queue").select("*").order("queued_at", { ascending: true }).limit(50);
    if (qErr) throw qErr;
    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Queue kosong", ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const item of queue) {
      summary.processed++;
      try {
        const r = await processOne(webAppUrl, supa, item);
        if (r.skipped) {
          summary.skipped++;
          await supa.from("backup_logs").insert({
            kelas_id: item.kelas_id, mapel_id: item.mapel_id,
            kelas_nama: r.kelasNama, mapel_nama: r.mapelNama,
            status: "skipped", error_message: "Tidak ada siswa di kelas",
            duration_ms: r.ms,
            queued_by: item.queued_by,
          });
        } else {
          summary.succeeded++;
          await supa.from("backup_logs").insert({
            kelas_id: item.kelas_id, mapel_id: item.mapel_id,
            kelas_nama: r.kelasNama, mapel_nama: r.mapelNama,
            status: "success", drive_file_id: r.fileId, drive_file_name: r.fileName,
            duration_ms: r.ms,
            queued_by: item.queued_by,
          });
        }
        await supa.from("backup_queue").delete().eq("id", item.id);
        summary.items.push({ kelas: r.kelasNama, mapel: r.mapelNama, status: r.skipped ? "skipped" : "ok" });
      } catch (err: any) {
        summary.failed++;
        const msg = err?.message ?? String(err);
        const attempts = (item.attempts ?? 0) + 1;
        await supa.from("backup_logs").insert({
          kelas_id: item.kelas_id, mapel_id: item.mapel_id,
          status: "error", error_message: msg,
          queued_by: item.queued_by,
        });
        if (attempts >= 3) {
          await supa.from("backup_queue").delete().eq("id", item.id);
        } else {
          await supa.from("backup_queue").update({ attempts, last_error: msg }).eq("id", item.id);
        }
        summary.items.push({ kelas_id: item.kelas_id, mapel_id: item.mapel_id, status: "error", error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("backup-rekap-drive fatal:", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err), ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
