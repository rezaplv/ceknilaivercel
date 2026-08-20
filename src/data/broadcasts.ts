export interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  targetKelas: string[]; // kosong = semua kelas
  targetMapel: string[]; // kosong = semua mapel
  createdBy: string;
  date: string;
}

// Shared broadcast store (demo, will be replaced by DB later)
let broadcasts: BroadcastItem[] = [
  {
    id: "1",
    title: "Jadwal UAS Semester Genap",
    message: "Ujian akan dilaksanakan 15-25 Juni 2026. Pastikan persiapan kalian sudah matang.",
    targetKelas: [],
    targetMapel: [],
    createdBy: "admin",
    date: "5 Feb 2026",
  },
  {
    id: "2",
    title: "Pengumpulan Tugas Proyek",
    message: "Batas akhir pengumpulan tugas proyek semester ini adalah 28 Februari 2026.",
    targetKelas: ["X-A"],
    targetMapel: ["Matematika"],
    createdBy: "guru1",
    date: "1 Feb 2026",
  },
  {
    id: "3",
    title: "Remedial Fisika",
    message: "Siswa yang belum tuntas harap mengikuti remedial hari Sabtu, 15 Feb 2026.",
    targetKelas: ["X-A", "X-B"],
    targetMapel: ["Fisika"],
    createdBy: "guru1",
    date: "10 Feb 2026",
  },
];

let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function getBroadcasts(): BroadcastItem[] {
  return [...broadcasts];
}

export function addBroadcast(item: Omit<BroadcastItem, "id">) {
  broadcasts = [{ ...item, id: String(Date.now()) }, ...broadcasts];
  notify();
}

export function removeBroadcast(id: string) {
  broadcasts = broadcasts.filter((b) => b.id !== id);
  notify();
}

export function subscribeBroadcasts(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Filter broadcasts relevant to a student based on their kelas and mapel.
 * A broadcast matches if:
 * - targetKelas is empty (semua kelas) OR student's kelas is in targetKelas
 * - AND targetMapel is empty (semua mapel) OR any of student's mapel is in targetMapel
 */
export function getStudentBroadcasts(
  studentKelas: string[],
  studentMapel: string[]
): BroadcastItem[] {
  return broadcasts.filter((b) => {
    const kelasMatch = b.targetKelas.length === 0 || b.targetKelas.some((k) => studentKelas.includes(k));
    const mapelMatch = b.targetMapel.length === 0 || b.targetMapel.some((m) => studentMapel.includes(m));
    return kelasMatch && mapelMatch;
  });
}
