export type NilaiType = "angka" | "ceklis";

export interface ScoreEntry {
  id: string;
  kelas: string;
  mapel: string;
  jenis: "FORMATIF" | "SUMATIF" | "STS" | "SAS";
  namaPenilaian: string;
  studentId: string;
  studentNama: string;
  nilai: number; // for angka type, or 1/0 for ceklis
  nilaiType: NilaiType;
  visible: boolean; // for formatif visibility toggle
  createdBy: string;
  kkm: number;
}

let scores: ScoreEntry[] = [
  // Demo data - Matematika X-A
  { id: "d1", kelas: "X-A", mapel: "Matematika", jenis: "FORMATIF", namaPenilaian: "Kuis Bab 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 85, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d2", kelas: "X-A", mapel: "Matematika", jenis: "FORMATIF", namaPenilaian: "Kuis Bab 2", studentId: "s1", studentNama: "Andi Pratama", nilai: 78, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d2b", kelas: "X-A", mapel: "Matematika", jenis: "FORMATIF", namaPenilaian: "Tugas Harian", studentId: "s1", studentNama: "Andi Pratama", nilai: 1, nilaiType: "ceklis", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d3", kelas: "X-A", mapel: "Matematika", jenis: "SUMATIF", namaPenilaian: "Ulangan Harian 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 80, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d3b", kelas: "X-A", mapel: "Matematika", jenis: "SUMATIF", namaPenilaian: "Ulangan Harian 2", studentId: "s1", studentNama: "Andi Pratama", nilai: 75, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d4", kelas: "X-A", mapel: "Matematika", jenis: "STS", namaPenilaian: "STS", studentId: "s1", studentNama: "Andi Pratama", nilai: 82, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },
  { id: "d5", kelas: "X-A", mapel: "Matematika", jenis: "SAS", namaPenilaian: "SAS", studentId: "s1", studentNama: "Andi Pratama", nilai: 88, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 75 },

  // Fisika X-A
  { id: "d6", kelas: "X-A", mapel: "Fisika", jenis: "FORMATIF", namaPenilaian: "Praktikum 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 90, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 70 },
  { id: "d6b", kelas: "X-A", mapel: "Fisika", jenis: "FORMATIF", namaPenilaian: "Laporan Praktikum", studentId: "s1", studentNama: "Andi Pratama", nilai: 1, nilaiType: "ceklis", visible: true, createdBy: "guru1", kkm: 70 },
  { id: "d7", kelas: "X-A", mapel: "Fisika", jenis: "SUMATIF", namaPenilaian: "UH 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 88, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 70 },
  { id: "d8", kelas: "X-A", mapel: "Fisika", jenis: "STS", namaPenilaian: "STS", studentId: "s1", studentNama: "Andi Pratama", nilai: 92, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 70 },
  { id: "d9", kelas: "X-A", mapel: "Fisika", jenis: "SAS", namaPenilaian: "SAS", studentId: "s1", studentNama: "Andi Pratama", nilai: 87, nilaiType: "angka", visible: true, createdBy: "guru1", kkm: 70 },

  // Kimia X-A
  { id: "d10", kelas: "X-A", mapel: "Kimia", jenis: "FORMATIF", namaPenilaian: "Kuis 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 75, nilaiType: "angka", visible: true, createdBy: "guru2", kkm: 72 },
  { id: "d10b", kelas: "X-A", mapel: "Kimia", jenis: "FORMATIF", namaPenilaian: "Tugas Praktikum", studentId: "s1", studentNama: "Andi Pratama", nilai: 0, nilaiType: "ceklis", visible: true, createdBy: "guru2", kkm: 72 },
  { id: "d11", kelas: "X-A", mapel: "Kimia", jenis: "SUMATIF", namaPenilaian: "UH 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 80, nilaiType: "angka", visible: true, createdBy: "guru2", kkm: 72 },
  { id: "d12", kelas: "X-A", mapel: "Kimia", jenis: "STS", namaPenilaian: "STS", studentId: "s1", studentNama: "Andi Pratama", nilai: 70, nilaiType: "angka", visible: true, createdBy: "guru2", kkm: 72 },
  { id: "d13", kelas: "X-A", mapel: "Kimia", jenis: "SAS", namaPenilaian: "SAS", studentId: "s1", studentNama: "Andi Pratama", nilai: 78, nilaiType: "angka", visible: true, createdBy: "guru2", kkm: 72 },

  // Bahasa Indonesia X-A
  { id: "d14", kelas: "X-A", mapel: "Bahasa Indonesia", jenis: "FORMATIF", namaPenilaian: "Tugas 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 88, nilaiType: "angka", visible: true, createdBy: "admin", kkm: 75 },
  { id: "d15", kelas: "X-A", mapel: "Bahasa Indonesia", jenis: "SUMATIF", namaPenilaian: "UH 1", studentId: "s1", studentNama: "Andi Pratama", nilai: 85, nilaiType: "angka", visible: true, createdBy: "admin", kkm: 75 },
  { id: "d16", kelas: "X-A", mapel: "Bahasa Indonesia", jenis: "STS", namaPenilaian: "STS", studentId: "s1", studentNama: "Andi Pratama", nilai: 90, nilaiType: "angka", visible: true, createdBy: "admin", kkm: 75 },
  { id: "d17", kelas: "X-A", mapel: "Bahasa Indonesia", jenis: "SAS", namaPenilaian: "SAS", studentId: "s1", studentNama: "Andi Pratama", nilai: 82, nilaiType: "angka", visible: true, createdBy: "admin", kkm: 75 },
];

let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function getScores(): ScoreEntry[] {
  return [...scores];
}

export function addScores(entries: Omit<ScoreEntry, "id">[]) {
  const newEntries = entries.map((e) => ({ ...e, id: String(Date.now() + Math.random()) }));
  scores = [...scores, ...newEntries];
  notify();
}

export function subscribeScores(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Get scores for a specific student filtered by their kelas and mapel.
 * For FORMATIF, only returns visible scores.
 */
export function getStudentScores(
  studentId: string,
  studentKelas: string[],
  studentMapel: string[]
): ScoreEntry[] {
  return scores.filter((s) => {
    if (s.studentId !== studentId) return false;
    if (!studentKelas.includes(s.kelas)) return false;
    if (!studentMapel.includes(s.mapel)) return false;
    // Hide formatif scores that are not visible
    if (s.jenis === "FORMATIF" && !s.visible) return false;
    return true;
  });
}

export interface MapelSummary {
  mapel: string;
  formatif: number | null;
  sumatif: number | null;
  sts: number | null;
  sas: number | null;
  nilaiAkhir: number | null;
}

/**
 * Calculate summary per mapel for a student.
 * NA = (2*avg_formatif + 2*avg_sumatif + STS + SAS) / 6
 */
export function getStudentMapelSummary(
  studentId: string,
  studentKelas: string[],
  studentMapel: string[]
): MapelSummary[] {
  const studentScores = getStudentScores(studentId, studentKelas, studentMapel);

  return studentMapel.map((mapel) => {
    const mapelScores = studentScores.filter((s) => s.mapel === mapel);

    const formatifScores = mapelScores.filter((s) => s.jenis === "FORMATIF");
    const sumatifScores = mapelScores.filter((s) => s.jenis === "SUMATIF");
    const stsScore = mapelScores.find((s) => s.jenis === "STS");
    const sasScore = mapelScores.find((s) => s.jenis === "SAS");

    const avgFormatif = formatifScores.length > 0
      ? formatifScores.reduce((sum, s) => sum + s.nilai, 0) / formatifScores.length
      : null;
    const avgSumatif = sumatifScores.length > 0
      ? sumatifScores.reduce((sum, s) => sum + s.nilai, 0) / sumatifScores.length
      : null;
    const sts = stsScore?.nilai ?? null;
    const sas = sasScore?.nilai ?? null;

    let nilaiAkhir: number | null = null;
    if (avgFormatif !== null && avgSumatif !== null && sts !== null && sas !== null) {
      nilaiAkhir = (2 * avgFormatif + 2 * avgSumatif + sts + sas) / 6;
    }

    return {
      mapel,
      formatif: avgFormatif !== null ? Math.round(avgFormatif * 10) / 10 : null,
      sumatif: avgSumatif !== null ? Math.round(avgSumatif * 10) / 10 : null,
      sts,
      sas,
      nilaiAkhir: nilaiAkhir !== null ? Math.round(nilaiAkhir * 10) / 10 : null,
    };
  });
}
