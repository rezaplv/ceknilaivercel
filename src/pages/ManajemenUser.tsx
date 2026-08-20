import { useState, useEffect, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, X, Upload, Users, UserPlus, FileSpreadsheet, Download, AlertTriangle, Copy, Check, Eye, EyeOff, Archive, Undo2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchAllUsers, callManageUsers, fetchKelasList, fetchMapelList, archiveUser, restoreUser, archiveUsersByKelas, restoreUsersByKelas, deleteUsersByKelas, archiveUsersByRole, restoreUsersByRole, deleteArchivedUsersByRole, type DbUser } from "@/lib/api";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

type TabRole = "ADMIN" | "GURU" | "SISWA";
type AddMode = "satuan" | "batch" | "upload";

interface SingleForm {
  username: string;
  password: string;
  nama: string;
  role: TabRole;
  kelas: string[];
  mapel: string[];
}

interface BatchParsed {
  nama: string;
  username: string;
  password: string;
}

function romawiToNumber(romawi: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
  let result = 0;
  for (let i = 0; i < romawi.length; i++) {
    const curr = map[romawi[i]] || 0;
    const next = map[romawi[i + 1]] || 0;
    if (curr < next) result -= curr;
    else result += curr;
  }
  return result;
}

function compareKelasName(a: string, b: string): number {
  const parse = (s: string) => {
    const parts = s.trim().split(/\s+/);
    const tingkat = romawiToNumber(parts[0] || "");
    const abjad = parts[1] || "";
    return { tingkat, abjad };
  };
  const ka = parse(a);
  const kb = parse(b);
  if (ka.tingkat !== kb.tingkat) return ka.tingkat - kb.tingkat;
  return ka.abjad.localeCompare(kb.abjad);
}

export default function ManajemenUser() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePageTitle("Manajemen User");
  const [activeTab, setActiveTab] = useState<TabRole>(user?.role === "ADMIN" ? "GURU" : "SISWA");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("satuan");
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteRole, setBulkDeleteRole] = useState<TabRole | null>(null);
  const [createdUserInfo, setCreatedUserInfo] = useState<{ nama: string; username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSinglePassword, setShowSinglePassword] = useState(false);

  const [editUser, setEditUser] = useState<DbUser | null>(null);
  const [editForm, setEditForm] = useState({ nama: "", username: "", kelas: [] as string[], mapel: [] as string[], password: "" });

  const [singleForm, setSingleForm] = useState<SingleForm>({
    username: "", password: "", nama: "", role: "GURU", kelas: [], mapel: [],
  });

  const [batchRole, setBatchRole] = useState<TabRole>("SISWA");
  const [batchNamaText, setBatchNamaText] = useState("");
  const [batchKelas, setBatchKelas] = useState<string[]>([]);
  const [batchMapel, setBatchMapel] = useState<string[]>([]);
  const [batchUsernameMode, setBatchUsernameMode] = useState<"system" | "nama">("system");
  const [batchParsed, setBatchParsed] = useState<BatchParsed[]>([]);
  const [batchStep, setBatchStep] = useState<1 | 2>(1);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadRole, setUploadRole] = useState<TabRole>("SISWA");
  const [saving, setSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const [kelasList, setKelasList] = useState<{ id: string; nama: string }[]>([]);
  const [mapelList, setMapelList] = useState<{ id: string; nama: string }[]>([]);

  const [showArchived, setShowArchived] = useState(false);
  const [kelasFilter, setKelasFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [purgeConfirmId, setPurgeConfirmId] = useState<string | null>(null);
  const [bulkKelasAction, setBulkKelasAction] = useState<{ kelas: string; mode: "archive" | "restore" | "delete"; count: number; all?: boolean } | null>(null);
  const [bulkRoleAction, setBulkRoleAction] = useState<{ role: TabRole; mode: "archive" | "restore" | "delete"; count: number } | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [dupConfirm, setDupConfirm] = useState<{
    existing: { nama: string; location: string; username: string }[];
    inside: { nama: string; count: number }[];
    onConfirm: () => void;
  } | null>(null);
  const [guruReject, setGuruReject] = useState<{ conflicts: { kelas: string; mapel: string; guru: string; username: string; namaBaru?: string }[] } | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const allUsers = await fetchAllUsers(true); // include archived; we'll filter in UI
    setUsers(allUsers);
    setLoadingUsers(false);
  };

  useEffect(() => { loadUsers(); fetchKelasList(true).then((list) => setKelasList(list.sort((a, b) => compareKelasName(a.nama, b.nama)))); fetchMapelList().then(setMapelList); }, []);

  if (!user || user.role === "SISWA") return null;

  const tabs: TabRole[] = user.role === "ADMIN" ? ["ADMIN", "GURU", "SISWA"] : ["SISWA"];
  const guruKelas = user.kelas || [];
  const filtered = users.filter((u) => {
    if (u.role !== activeTab) return false;
    // Filter active vs archived
    const isArchived = !!u.archived_at;
    if (showArchived && (activeTab === "SISWA" || activeTab === "GURU")) {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
    }
    // GURU hanya melihat SISWA dari kelas yang diampu
    if (user.role === "GURU" && u.role === "SISWA") {
      if (guruKelas.length === 0) return false;
      if (!u.kelas.some((k) => guruKelas.includes(k))) return false;
    }
    // Filter per kelas (hanya untuk SISWA tab pada ADMIN)
    if (activeTab === "SISWA" && user.role === "ADMIN" && kelasFilter !== "ALL") {
      if (!u.kelas.includes(kelasFilter)) return false;
    }
    // Filter pencarian global
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inNama = u.nama_lengkap.toLowerCase().includes(q);
      const inUsername = u.username.toLowerCase().includes(q);
      const inKelas = u.kelas.some((k) => k.toLowerCase().includes(q));
      const inMapel = u.mapel.some((m) => m.toLowerCase().includes(q));
      if (!inNama && !inUsername && !inKelas && !inMapel) return false;
    }
    return true;
  }).sort((a, b) => {
    const kelasA = a.kelas[0] || "-";
    const kelasB = b.kelas[0] || "-";
    const kelasCompare = compareKelasName(kelasA, kelasB);
    if (kelasCompare !== 0) return kelasCompare;
    return a.nama_lengkap.localeCompare(b.nama_lengkap);
  });

  const allowedRoles: TabRole[] = user.role === "ADMIN" ? ["GURU", "SISWA"] : ["SISWA"];

  const guruMapel = user.mapel || [];
  const availableKelasList = user.role === "GURU" ? kelasList.filter((k) => guruKelas.includes(k.nama)) : kelasList;
  const availableMapelList = user.role === "GURU" ? mapelList.filter((m) => guruMapel.includes(m.nama)) : mapelList;

  const resetForms = () => {
    setSingleForm({ username: "", password: "", nama: "", role: allowedRoles[0], kelas: [], mapel: [] });
    setBatchRole(allowedRoles.includes("SISWA") ? "SISWA" : allowedRoles[0]);
    setBatchNamaText(""); setBatchKelas([]); setBatchMapel([]);
    setBatchUsernameMode("system"); setBatchParsed([]); setBatchStep(1);
    setUploadedFile(null);
    setUploadRole(allowedRoles.includes("SISWA") ? "SISWA" : allowedRoles[0]);
  };

  const openModal = () => { resetForms(); setAddMode("satuan"); setShowAddModal(true); };
  const closeModal = () => setShowAddModal(false);

  // === Deteksi nama duplikat ===
  const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const describeUserLocation = (u: DbUser) => {
    const roleLabel = u.role === "SISWA" ? "Siswa" : u.role === "GURU" ? "Guru" : "Admin";
    const where = u.kelas && u.kelas.length > 0 ? ` kelas ${u.kelas.join(", ")}` : "";
    const status = u.archived_at ? " (arsip)" : "";
    return `${roleLabel}${where}${status}`;
  };
  const findDuplicateUser = (nama: string, username?: string): DbUser | undefined => {
    const n = normalizeName(nama);
    const uname = (username || "").trim().toLowerCase();
    if (!n && !uname) return undefined;
    return users.find((u) => {
      if (n && normalizeName(u.nama_lengkap) === n) return true;
      if (uname && (u.username || "").trim().toLowerCase() === uname) return true;
      return false;
    });
  };
  // Deteksi guru yang sudah mengajar kombinasi kelas+mapel yang sama
  const findGuruAssignmentConflicts = (kelas: string[], mapel: string[]): DbUser[] => {
    if (!kelas.length || !mapel.length) return [];
    return users.filter((u) =>
      u.role === "GURU" &&
      (u.kelas || []).some((k) => kelas.includes(k)) &&
      (u.mapel || []).some((m) => mapel.includes(m))
    );
  };
  const describeGuruConflict = (u: DbUser, kelas: string[], mapel: string[]) => {
    const sharedKelas = (u.kelas || []).filter((k) => kelas.includes(k));
    const sharedMapel = (u.mapel || []).filter((m) => mapel.includes(m));
    const status = u.archived_at ? " (arsip)" : "";
    return `Guru kelas ${sharedKelas.join(", ")} mengajar ${sharedMapel.join(", ")}${status}`;
  };

  // Deteksi pasangan (kelas, mapel) yang sudah persis diajar guru aktif lain → hard reject
  type GuruPairConflict = { kelas: string; mapel: string; guru: string; username: string; namaBaru?: string };
  const findGuruPairConflicts = (kelas: string[], mapel: string[], namaBaru?: string): GuruPairConflict[] => {
    const out: GuruPairConflict[] = [];
    if (!kelas.length || !mapel.length) return out;
    for (const k of kelas) {
      for (const m of mapel) {
        for (const u of users) {
          if (u.role !== "GURU" || u.archived_at) continue;
          if ((u.kelas || []).includes(k) && (u.mapel || []).includes(m)) {
            out.push({ kelas: k, mapel: m, guru: u.nama_lengkap, username: u.username, namaBaru });
          }
        }
      }
    }
    return out;
  };

  const performSaveSingle = async () => {
    setSaving(true);
    const cleanUsername = singleForm.username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanPassword = singleForm.password.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const res = await callManageUsers("create-user", {
      username: cleanUsername,
      password: cleanPassword,
      nama_lengkap: singleForm.nama,
      role: singleForm.role,
      kelas: singleForm.kelas,
      mapel: singleForm.mapel,
    });
    setSaving(false);
    if (res.error) {
      toast({ title: "Gagal menambahkan akun", description: res.error, variant: "destructive" });
    } else {
      const roleLabel = singleForm.role === "SISWA" ? "siswa" : singleForm.role === "GURU" ? "guru" : "admin";
      toast({ title: "Akun berhasil dibuat", description: `Akun ${roleLabel} ${singleForm.nama} berhasil ditambahkan.` });
      setCreatedUserInfo({ nama: singleForm.nama, username: cleanUsername, password: cleanPassword });
      closeModal();
      loadUsers();
    }
  };


  const handleSaveSingle = async () => {
    const missing: string[] = [];
    if (!singleForm.username.trim()) missing.push("Username");
    if (!singleForm.password.trim()) missing.push("Password");
    if (!singleForm.nama.trim()) missing.push("Nama Lengkap");
    if (singleForm.role === "SISWA" && singleForm.kelas.length === 0) missing.push("Kelas");
    if (singleForm.role === "GURU") {
      if (singleForm.kelas.length === 0) missing.push("Kelas");
      if (singleForm.mapel.length === 0) missing.push("Mata Pelajaran");
    }
    if (missing.length > 0) {
      toast({ title: "Field wajib belum diisi", description: missing.join(", "), variant: "destructive" });
      return;
    }
    const existingDup: { nama: string; location: string; username: string }[] = [];
    const dup = findDuplicateUser(singleForm.nama, singleForm.username);
    if (dup) existingDup.push({ nama: dup.nama_lengkap, location: describeUserLocation(dup), username: dup.username });
    if (singleForm.role === "GURU") {
      const pairConflicts = findGuruPairConflicts(singleForm.kelas, singleForm.mapel, singleForm.nama);
      if (pairConflicts.length > 0) {
        setGuruReject({ conflicts: pairConflicts });
        return;
      }
      const conflicts = findGuruAssignmentConflicts(singleForm.kelas, singleForm.mapel);
      for (const c of conflicts) {
        if (existingDup.some((e) => e.username === c.username)) continue;
        existingDup.push({ nama: c.nama_lengkap, location: describeGuruConflict(c, singleForm.kelas, singleForm.mapel), username: c.username });
      }
    }
    if (existingDup.length > 0) {
      setDupConfirm({
        existing: existingDup,
        inside: [],
        onConfirm: () => { setDupConfirm(null); performSaveSingle(); },
      });
      return;
    }
    await performSaveSingle();
  };


  const generateUsername = (nama: string, mode: "system" | "nama", index: number): string => {
    if (mode === "nama") {
      // Sanitize: lowercase, remove spaces (join directly), keep alphanumeric only
      const sanitized = nama.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
      return sanitized || `user${index}`;
    }
    return `user${Date.now().toString(36)}${index}`;
  };

  const generatePassword = (mode: "system" | "nama", nama: string): string => {
    if (mode === "nama") return nama.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
    return Math.random().toString(36).slice(2, 10);
  };

  const handleParseBatch = () => {
    const names = batchNamaText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) { toast({ title: "Error", description: "Masukkan minimal satu nama", variant: "destructive" }); return; }

    const proceed = () => {
      const parsed: BatchParsed[] = names.map((nama, i) => ({
        nama,
        username: generateUsername(nama, batchUsernameMode, i + 1),
        password: generatePassword(batchUsernameMode, nama),
      }));
      setBatchParsed(parsed);
      setBatchStep(2);
    };

    // Cek duplikat terhadap user yang sudah ada di database
    const existing: { nama: string; location: string; username: string }[] = [];
    for (const nama of names) {
      const dup = findDuplicateUser(nama);
      if (dup) existing.push({ nama, location: describeUserLocation(dup), username: dup.username });
    }
    // Cek duplikat di dalam daftar input itu sendiri
    const seen = new Map<string, number>();
    for (const nama of names) {
      const k = normalizeName(nama);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const inside: { nama: string; count: number }[] = [];
    seen.forEach((count, k) => { if (count > 1) inside.push({ nama: k, count }); });

    // Untuk batch GURU: cek kombinasi kelas+mapel yang sudah dipegang guru lain
    if (batchRole === "GURU") {
      const pairConflicts = findGuruPairConflicts(batchKelas, batchMapel);
      if (pairConflicts.length > 0) {
        setGuruReject({ conflicts: pairConflicts });
        return;
      }
      const conflicts = findGuruAssignmentConflicts(batchKelas, batchMapel);
      for (const c of conflicts) {
        if (existing.some((e) => e.username === c.username)) continue;
        existing.push({ nama: c.nama_lengkap, location: describeGuruConflict(c, batchKelas, batchMapel), username: c.username });
      }
    }

    if (existing.length > 0 || inside.length > 0) {
      setDupConfirm({ existing, inside, onConfirm: () => { setDupConfirm(null); proceed(); } });
      return;
    }
    proceed();
  };

  

  const handleSaveBatch = async () => {
    if (batchParsed.length === 0) return;
    setSaving(true);
    const allUsers = batchParsed.map((e) => ({
      username: e.username,
      password: e.password,
      nama_lengkap: e.nama,
      role: batchRole,
      kelas: batchKelas,
      mapel: batchRole === "SISWA" ? [] : batchMapel,
    }));

    const CHUNK_SIZE = 10;
    const chunks: typeof allUsers[] = [];
    for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
      chunks.push(allUsers.slice(i, i + CHUNK_SIZE));
    }

    let totalSuccess = 0;
    let totalFailed = 0;
    setBatchProgress({ current: 0, total: allUsers.length });

    for (let i = 0; i < chunks.length; i++) {
      let res = await callManageUsers("create-users-batch", { users: chunks[i] });
      // Retry once on rate limit
      if (res.error && !res.results) {
        await new Promise(r => setTimeout(r, 2500));
        res = await callManageUsers("create-users-batch", { users: chunks[i] });
      }
      const chunkSuccess = res.results?.filter((r: any) => r.success).length || 0;
      totalSuccess += chunkSuccess;
      totalFailed += (chunks[i].length - chunkSuccess);
      setBatchProgress({ current: totalSuccess + totalFailed, total: allUsers.length });
      // Delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 2500));
    }

    setBatchProgress(null);
    setSaving(false);
    const roleLabel = batchRole === "SISWA" ? "siswa" : batchRole === "GURU" ? "guru" : "user";
    if (totalSuccess === 0) {
      toast({
        title: "Gagal menambahkan akun",
        description: `Tidak ada akun ${roleLabel} yang berhasil ditambahkan${totalFailed > 0 ? ` (${totalFailed} gagal)` : ""}.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: totalFailed > 0 ? "Sebagian berhasil" : "Berhasil ditambahkan",
        description: `${totalSuccess} akun ${roleLabel} berhasil ditambahkan${totalFailed > 0 ? `, ${totalFailed} gagal` : ""}.`,
        variant: totalFailed > 0 ? "destructive" : "default",
      });
    }
    closeModal();
    loadUsers();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !file.name.endsWith(".csv")) {
      toast({ title: "Error", description: "Hanya file CSV yang diperbolehkan", variant: "destructive" });
      return;
    }
    if (file) setUploadedFile(file);
  };

  const handleUploadSave = () => {
    if (!uploadedFile) { toast({ title: "Error", description: "Pilih file CSV terlebih dahulu", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) { toast({ title: "Error", description: "File CSV kosong atau hanya header", variant: "destructive" }); return; }
      const rows = lines.slice(1);
      const csvUsers = rows.map((row) => {
        // Support tab, semicolon, or comma as separator
        const sep = row.includes("\t") ? "\t" : row.includes(";") ? ";" : ",";
        const cols = row.split(sep).map((c) => c.trim());
        return {
          nama_lengkap: cols[0] || "",
          kelas: cols[1] ? cols[1].split(";").map(s => s.trim()).filter(Boolean) : [],
          mapel: cols[2] ? cols[2].split(";").map(s => s.trim()).filter(Boolean) : [],
          username: cols[3] || "",
          password: cols[4] || "password123",
          role: uploadRole,
        };
      }).filter((u) => u.username && u.nama_lengkap);
      if (csvUsers.length === 0) { toast({ title: "Error", description: "Tidak ada data valid dalam file CSV", variant: "destructive" }); return; }

      const performImport = async () => {
        setSaving(true);
        const CHUNK_SIZE = 10;
        const chunks: typeof csvUsers[] = [];
        for (let i = 0; i < csvUsers.length; i += CHUNK_SIZE) {
          chunks.push(csvUsers.slice(i, i + CHUNK_SIZE));
        }
        let totalSuccess = 0;
        let totalFailed = 0;
        setBatchProgress({ current: 0, total: csvUsers.length });
        for (let i = 0; i < chunks.length; i++) {
          let res = await callManageUsers("create-users-batch", { users: chunks[i] });
          if (res.error && !res.results) {
            await new Promise(r => setTimeout(r, 2500));
            res = await callManageUsers("create-users-batch", { users: chunks[i] });
          }
          const chunkSuccess = res.results?.filter((r: any) => r.success).length || 0;
          totalSuccess += chunkSuccess;
          totalFailed += (chunks[i].length - chunkSuccess);
          setBatchProgress({ current: totalSuccess + totalFailed, total: csvUsers.length });
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 2500));
        }
        setBatchProgress(null);
        setSaving(false);
        const roleLabel = uploadRole === "SISWA" ? "siswa" : uploadRole === "GURU" ? "guru" : "user";
        if (totalSuccess === 0) {
          toast({
            title: "Impor CSV gagal",
            description: `Tidak ada akun ${roleLabel} yang berhasil diimpor${totalFailed > 0 ? ` (${totalFailed} gagal)` : ""}.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: totalFailed > 0 ? "Sebagian berhasil diimpor" : "Impor CSV berhasil",
            description: `${totalSuccess} akun ${roleLabel} berhasil ditambahkan dari CSV${totalFailed > 0 ? `, ${totalFailed} gagal` : ""}.`,
            variant: totalFailed > 0 ? "destructive" : "default",
          });
        }
        closeModal();
        loadUsers();
      };

      // Cek duplikat nama: terhadap database & di dalam file CSV sendiri
      const existing: { nama: string; location: string; username: string }[] = [];
      for (const u of csvUsers) {
        const dup = findDuplicateUser(u.nama_lengkap, u.username);
        if (dup) existing.push({ nama: u.nama_lengkap, location: describeUserLocation(dup), username: dup.username });
      }
      const seenCsv = new Map<string, number>();
      for (const u of csvUsers) {
        const k = normalizeName(u.nama_lengkap);
        seenCsv.set(k, (seenCsv.get(k) || 0) + 1);
      }
      const inside: { nama: string; count: number }[] = [];
      seenCsv.forEach((count, k) => { if (count > 1) inside.push({ nama: k, count }); });

      // Untuk CSV GURU: cek kombinasi kelas+mapel yang sudah dipegang guru lain
      if (uploadRole === "GURU") {
        const allPairConflicts: { kelas: string; mapel: string; guru: string; username: string; namaBaru?: string }[] = [];
        for (const u of csvUsers) {
          const pc = findGuruPairConflicts(u.kelas, u.mapel, u.nama_lengkap);
          for (const p of pc) allPairConflicts.push(p);
        }
        if (allPairConflicts.length > 0) {
          setGuruReject({ conflicts: allPairConflicts });
          return;
        }
        for (const u of csvUsers) {
          const conflicts = findGuruAssignmentConflicts(u.kelas, u.mapel);
          for (const c of conflicts) {
            if (existing.some((e) => e.username === c.username)) continue;
            existing.push({ nama: c.nama_lengkap, location: describeGuruConflict(c, u.kelas, u.mapel), username: c.username });
          }
        }
      }

      if (existing.length > 0 || inside.length > 0) {
        setDupConfirm({ existing, inside, onConfirm: () => { setDupConfirm(null); performImport(); } });
        return;
      }
      await performImport();
    };
    reader.readAsText(uploadedFile);
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ["nama_lengkap", "kelas", "mapel", "username", "password"],
      ["Andi Pratama", "X-A", "Matematika", "andi01", "password123"],
      ["Budi Cahyono", "X-B", "Fisika", "budi02", "password456"],
      ["Siti Aminah", "XI-IPA", "Kimia", "siti03", "password789"],
    ];
    const csv = rows.map(r => r.join(",")).join("\n") + "\n";
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "template_user.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (u: DbUser) => {
    setEditUser(u);
    setEditForm({ nama: u.nama_lengkap, username: u.username, kelas: [...u.kelas], mapel: [...u.mapel], password: "" });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (!editForm.nama || !editForm.username) { toast({ title: "Error", description: "Nama dan username harus diisi", variant: "destructive" }); return; }
    setSaving(true);
    const updatePayload: any = {
      user_id: editUser.user_id,
      username: editForm.username,
      nama_lengkap: editForm.nama,
      kelas: editForm.kelas,
      mapel: editForm.mapel,
    };
    if (editForm.password.trim()) updatePayload.password = editForm.password.trim();
    const res = await callManageUsers("update-user", updatePayload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Gagal memperbarui akun", description: res.error, variant: "destructive" });
    } else {
      if (editForm.password.trim()) {
        setCreatedUserInfo({ nama: editForm.nama, username: editForm.username, password: editForm.password.trim() });
      } else {
        const roleLabel = editUser.role === "SISWA" ? "siswa" : editUser.role === "GURU" ? "guru" : "user";
        toast({ title: "Berhasil diperbarui", description: `Akun ${roleLabel} ${editForm.nama} berhasil diperbarui.` });
      }
      setEditUser(null);
      loadUsers();
    }
  };

  const handleDelete = (id: string) => setDeleteConfirmId(id);
  const handleArchive = (id: string) => setArchiveConfirmId(id);
  const handlePurge = (id: string) => setPurgeConfirmId(id);

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const targetUser = users.find((u) => u.user_id === deleteConfirmId);
    const roleLabel = targetUser?.role === "SISWA" ? "siswa" : targetUser?.role === "GURU" ? "guru" : "user";
    setSaving(true);
    const res = await callManageUsers("delete-user", { user_id: deleteConfirmId });
    setSaving(false);
    if (res?.error) {
      toast({ title: "Gagal menghapus", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Akun dihapus", description: `Akun ${roleLabel} berhasil dihapus.` });
    }
    setDeleteConfirmId(null);
    loadUsers();
  };

  const confirmArchive = async () => {
    if (!archiveConfirmId) return;
    const targetUser = users.find((u) => u.user_id === archiveConfirmId);
    const roleLabel = targetUser?.role === "SISWA" ? "siswa" : targetUser?.role === "GURU" ? "guru" : "user";
    setSaving(true);
    const res = await archiveUser(archiveConfirmId);
    setSaving(false);
    if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
    else toast({ title: "Diarsipkan", description: `Akun ${roleLabel} diarsipkan. Data nilai tetap utuh & dapat dipulihkan.` });
    setArchiveConfirmId(null);
    loadUsers();
  };

  const confirmPurge = async () => {
    if (!purgeConfirmId) return;
    const targetUser = users.find((u) => u.user_id === purgeConfirmId);
    const roleLabel = targetUser?.role === "SISWA" ? "siswa" : targetUser?.role === "GURU" ? "guru" : "user";
    setSaving(true);
    const res = await callManageUsers("delete-user", { user_id: purgeConfirmId });
    setSaving(false);
    if (res?.error) {
      toast({ title: "Gagal menghapus permanen", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Dihapus permanen", description: `Akun & nilai ${roleLabel} dihapus selamanya.` });
    }
    setPurgeConfirmId(null);
    loadUsers();
  };

  const handleRestore = async (id: string) => {
    const targetUser = users.find((u) => u.user_id === id);
    const roleLabel = targetUser?.role === "SISWA" ? "siswa" : targetUser?.role === "GURU" ? "guru" : "user";
    const res = await restoreUser(id);
    if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
    else toast({ title: "Dipulihkan", description: `Akun ${roleLabel} aktif kembali.` });
    loadUsers();
  };

  const confirmBulkKelas = async () => {
    if (!bulkKelasAction) return;
    setSaving(true);
    let totalCount = 0;
    let errorMsg: string | null = null;
    const runFor = async (kelasNama: string) => {
      const r = bulkKelasAction.mode === "archive"
        ? await archiveUsersByKelas(kelasNama)
        : bulkKelasAction.mode === "restore"
          ? await restoreUsersByKelas(kelasNama)
          : await deleteUsersByKelas(kelasNama);
      if (r?.error) errorMsg = r.error;
      else totalCount += (r?.count ?? 0);
    };
    if (bulkKelasAction.all) {
      for (const k of kelasList) {
        await runFor(k.nama);
      }
    } else {
      await runFor(bulkKelasAction.kelas);
    }
    setSaving(false);
    if (errorMsg) {
      toast({ title: "Gagal", description: errorMsg, variant: "destructive" });
    } else if (totalCount === 0) {
      const scopeLabel = bulkKelasAction.all ? "pada semua kelas" : `pada kelas ${bulkKelasAction.kelas}`;
      toast({ title: "Tidak ada perubahan", description: `Tidak ada siswa ${scopeLabel} yang diproses.` });
    } else {
      const scopeLabel = bulkKelasAction.all ? "dari semua kelas" : `kelas ${bulkKelasAction.kelas}`;
      const actionLabel = bulkKelasAction.mode === "archive" ? "diarsipkan" : bulkKelasAction.mode === "restore" ? "dipulihkan" : "dihapus permanen";
      toast({
        title: bulkKelasAction.mode === "archive" ? "Berhasil diarsipkan" : bulkKelasAction.mode === "restore" ? "Berhasil dipulihkan" : "Berhasil dihapus permanen",
        description: `${totalCount} siswa ${scopeLabel} berhasil ${actionLabel}.`,
      });
    }
    setBulkKelasAction(null);
    setBulkConfirmText("");
    loadUsers();
  };

  const confirmBulkRole = async () => {
    if (!bulkRoleAction) return;
    setSaving(true);
    let res: any;
    if (bulkRoleAction.mode === "archive") {
      res = await archiveUsersByRole(bulkRoleAction.role);
    } else if (bulkRoleAction.mode === "restore") {
      res = await restoreUsersByRole(bulkRoleAction.role);
    } else {
      res = await deleteArchivedUsersByRole(bulkRoleAction.role);
    }
    setSaving(false);
    const roleLabel = bulkRoleAction.role === "SISWA" ? "siswa" : bulkRoleAction.role === "GURU" ? "guru" : "user";
    if (res?.error) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
    } else if ((res?.count ?? 0) === 0) {
      toast({ title: "Tidak ada perubahan", description: `Tidak ada akun ${roleLabel} yang diproses.` });
    } else {
      const actionLabel = bulkRoleAction.mode === "archive" ? "diarsipkan" : bulkRoleAction.mode === "restore" ? "dipulihkan" : "dihapus permanen";
      toast({
        title: bulkRoleAction.mode === "archive" ? "Berhasil diarsipkan" : bulkRoleAction.mode === "restore" ? "Berhasil dipulihkan" : "Berhasil dihapus permanen",
        description: `${res.count} akun ${roleLabel} berhasil ${actionLabel}.`,
      });
    }
    setBulkRoleAction(null);
    setBulkConfirmText("");
    loadUsers();
  };

  // GURU & SISWA hanya bisa diarsipkan; hapus permanen dilakukan dari tab Arsip.
  // Tidak ada lagi tombol hapus langsung maupun "Hapus Semua" untuk role mana pun.
  const canDeleteRole = (_role: TabRole) => false;
  const canArchiveRole = (role: TabRole) => user.role === "ADMIN" && (role === "SISWA" || role === "GURU");

  const handleBulkDelete = (role: TabRole) => { setBulkDeleteRole(role); setShowBulkDeleteModal(true); };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteRole) return;
    setSaving(true);
    const res = await callManageUsers("delete-users-bulk", { role: bulkDeleteRole });
    setSaving(false);
    const roleLabel = bulkDeleteRole === "SISWA" ? "siswa" : bulkDeleteRole === "GURU" ? "guru" : String(bulkDeleteRole).toLowerCase();
    if (res?.error) {
      toast({ title: "Gagal menghapus", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Semua akun dihapus", description: `Semua akun ${roleLabel} berhasil dihapus.` });
    }
    setShowBulkDeleteModal(false);
    setBulkDeleteRole(null);
    loadUsers();
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider";

  // === Tampilan khusus GURU: hanya daftar kelas yang diajar ===
  if (user.role === "GURU") {
    const kelasDiajar = (user.kelas || []).slice().sort(compareKelasName);
    const siswaPerKelas = (nama: string) =>
      users
        .filter((u) => u.role === "SISWA" && !u.archived_at && u.kelas.includes(nama))
        .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
    const filteredKelas = kelasFilter === "ALL" ? kelasDiajar : kelasDiajar.filter((k) => k === kelasFilter);
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40 flex-shrink-0">
                <Users className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Manajemen User</h2>
            </div>
            <p className="text-xs sm:text-sm text-foreground/70 mt-2 sm:mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
              Daftar kelas yang Anda ajar
            </p>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap hidden sm:inline">Filter Kelas:</label>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasDiajar.map((nama) => <option key={nama} value={nama}>{nama}</option>)}
            </select>
          </div>
        </div>

        {filteredKelas.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
            {loadingUsers ? "Memuat..." : "Tidak ada kelas yang cocok dengan filter."}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredKelas.map((nama) => {
              const siswa = siswaPerKelas(nama);
              return (
                <div key={nama} className="bg-card border rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 sm:p-5 border-b bg-muted/30">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold text-foreground truncate">Kelas {nama}</div>
                      <div className="text-xs text-muted-foreground">{siswa.length} siswa</div>
                    </div>
                  </div>
                  {siswa.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">Belum ada siswa di kelas ini.</div>
                  ) : (
                    <div className="divide-y">
                      {siswa.map((s, idx) => (
                        <div key={s.user_id} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/40 transition-colors">
                          <div className="w-7 text-xs font-semibold text-muted-foreground tabular-nums">{idx + 1}.</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{s.nama_lengkap}</div>
                            <div className="text-xs text-muted-foreground truncate">@{s.username}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40 flex-shrink-0">
              <Users className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Manajemen User</h2>
          </div>
          <p className="text-xs sm:text-sm text-foreground/70 mt-2 sm:mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
            Kelola akun pengguna sistem
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">

          {user.role === "ADMIN" && activeTab === "SISWA" && (() => {
            const activeSiswaCount = users.filter((u) => u.role === "SISWA" && !u.archived_at).length;
            const archivedSiswaCount = users.filter((u) => u.role === "SISWA" && u.archived_at).length;
            if (showArchived) {
              return (
                <>
                  {archivedSiswaCount > 0 && (
                    <>
                      <button
                        onClick={() => setBulkKelasAction({ kelas: "Semua Kelas", mode: "restore", count: archivedSiswaCount, all: true })}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-green-600 text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
                      >
                        <Undo2 className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Pulihkan Semua<span className="hidden sm:inline"> Kelas</span></span>
                      </button>
                      <button
                        onClick={() => setBulkKelasAction({ kelas: "Semua Kelas", mode: "delete", count: archivedSiswaCount, all: true })}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
                      >
                        <Trash2 className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Hapus Permanen<span className="hidden sm:inline"> Semua</span></span>
                      </button>
                    </>
                  )}
                </>
              );
            }
            return activeSiswaCount > 0 ? (
              <button
                onClick={() => setBulkKelasAction({ kelas: "Semua Kelas", mode: "archive", count: activeSiswaCount, all: true })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-amber-500 text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
              >
                <Archive className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Arsipkan Semua<span className="hidden sm:inline"> Kelas</span></span>
              </button>
            ) : null;
          })()}
          {user.role === "ADMIN" && activeTab === "GURU" && (() => {
            const activeGuruCount = users.filter((u) => u.role === "GURU" && !u.archived_at).length;
            const archivedGuruCount = users.filter((u) => u.role === "GURU" && u.archived_at).length;
            if (showArchived) {
              return (
                <>
                  {archivedGuruCount > 0 && (
                    <>
                      <button
                        onClick={() => setBulkRoleAction({ role: "GURU", mode: "restore", count: archivedGuruCount })}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-green-600 text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
                      >
                        <Undo2 className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Pulihkan Semua<span className="hidden sm:inline"> Guru</span></span>
                      </button>
                      <button
                        onClick={() => setBulkRoleAction({ role: "GURU", mode: "delete", count: archivedGuruCount })}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
                      >
                        <Trash2 className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Hapus Permanen<span className="hidden sm:inline"> Semua</span></span>
                      </button>
                    </>
                  )}
                </>
              );
            }
            return activeGuruCount > 0 ? (
              <button
                onClick={() => setBulkRoleAction({ role: "GURU", mode: "archive", count: activeGuruCount })}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-amber-500 text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial"
              >
                <Archive className="w-4 h-4 flex-shrink-0" /> <span className="truncate">Arsipkan Semua<span className="hidden sm:inline"> Guru</span></span>
              </button>
            ) : null;
          })()}
          {canDeleteRole(activeTab) && filtered.length > 0 && (
            <button onClick={() => handleBulkDelete(activeTab)} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-destructive text-destructive-foreground text-xs sm:text-sm font-semibold hover:brightness-110 transition-all flex-1 sm:flex-initial">
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Hapus Semua {activeTab}</span>
            </button>
          )}
          <button onClick={openModal} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:brightness-110 transition-all shadow-md flex-1 sm:flex-initial">
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>Tambah User</span>
          </button>
        </div>
      </div>


      <div className="flex gap-2 flex-wrap items-center">
        {tabs.map((t) => {
          const count = users.filter((u) => {
            if (u.role !== t) return false;
            if (u.archived_at) return false;
            if (user.role === "GURU" && u.role === "SISWA") {
              if (guruKelas.length === 0) return false;
              return u.kelas.some((k) => guruKelas.includes(k));
            }
            return true;
          }).length;
          return (
            <button key={t} onClick={() => { setActiveTab(t); setShowArchived(false); setKelasFilter("ALL"); setSearchQuery(""); }} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab === t && !showArchived ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              {t} ({count})
            </button>
          );
        })}
        {user.role === "ADMIN" && (activeTab === "SISWA" || activeTab === "GURU") && (() => {
          const archCount = users.filter((u) => u.role === activeTab && u.archived_at).length;
          const label = activeTab === "SISWA" ? "Arsip Siswa" : "Arsip Guru";
          return (
            <button onClick={() => setShowArchived((s) => !s)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5", showArchived ? "bg-amber-500 text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              <Archive className="w-3.5 h-3.5" /> {label} ({archCount})
            </button>
          );
        })()}
        {user.role === "ADMIN" && activeTab === "SISWA" && (
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap hidden sm:inline">Filter Kelas:</label>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
            </select>
          </div>
        )}
        <div className="relative w-full sm:w-auto sm:ml-auto order-last sm:order-none">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, username, kelas, mapel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-64"
          />
        </div>
      </div>


      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-12">No</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Username</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nama Lengkap</th>
                {activeTab !== "ADMIN" && (
                  <>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Kelas</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Mapel</th>
                  </>
                )}
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let counter = 0;
                let lastKelas = "";
                const colCount = activeTab === "ADMIN" ? 5 : 7;
                return filtered.map((u) => {
                  const kelasStr = u.kelas.join(", ") || "-";
                  counter++;
                  const showHeader = activeTab !== "ADMIN" && kelasStr !== lastKelas;
                  lastKelas = kelasStr;
                  if (showHeader) counter = 1;
                  return (
                    <>{showHeader && (
                      <tr key={`header-${kelasStr}`} className="bg-primary/5">
                        <td colSpan={colCount} className="py-2 px-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Kelas: {kelasStr}</span>
                            {user.role === "ADMIN" && activeTab === "SISWA" && kelasStr !== "-" && (() => {
                              const countInKelas = filtered.filter((x) => x.role === "SISWA" && x.kelas.includes(kelasStr)).length;
                              return (
                                <div className="flex items-center gap-1.5">
                                  {!showArchived ? (
                                    <button onClick={() => setBulkKelasAction({ kelas: kelasStr, mode: "archive", count: countInKelas })} className="px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs font-semibold flex items-center gap-1 transition-colors" title={`Arsipkan kelas ${kelasStr}`}>
                                      <Archive className="w-3.5 h-3.5" /> Arsipkan Kelas
                                    </button>
                                  ) : (
                                    <>
                                      <button onClick={() => setBulkKelasAction({ kelas: kelasStr, mode: "restore", count: countInKelas })} className="px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 text-xs font-semibold flex items-center gap-1 transition-colors" title={`Pulihkan kelas ${kelasStr}`}>
                                        <Undo2 className="w-3.5 h-3.5" /> Pulihkan Kelas
                                      </button>
                                      <button onClick={() => setBulkKelasAction({ kelas: kelasStr, mode: "delete", count: countInKelas })} className="px-2 py-1 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1 transition-colors" title={`Hapus permanen kelas ${kelasStr}`}>
                                        <Trash2 className="w-3.5 h-3.5" /> Hapus Kelas
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={u.user_id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">{counter}</td>
                      <td className="py-3 px-4">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold",
                          u.role === "ADMIN" && "bg-primary/15 text-primary",
                          u.role === "GURU" && "bg-accent/50 text-accent-foreground",
                          u.role === "SISWA" && "bg-muted text-muted-foreground")}>{u.role}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{u.username}</td>
                      <td className="py-3 px-4 font-medium">{u.nama_lengkap}</td>
                      {activeTab !== "ADMIN" && (
                        <>
                          <td className="py-3 px-4 text-muted-foreground">{u.kelas.join(", ") || "-"}</td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">{((u.role === "SISWA" ? u.mapel_efektif : u.mapel) || u.mapel).join(", ") || "-"}</td>
                        </>
                      )}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {!showArchived && (
                            <button onClick={() => handleEdit(u)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                          )}
                          {!showArchived && canArchiveRole(u.role) && (
                            <button onClick={() => handleArchive(u.user_id)} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600 transition-colors" title="Arsipkan"><Archive className="w-4 h-4" /></button>
                          )}
                          {!showArchived && canDeleteRole(u.role) && (
                            <button onClick={() => handleDelete(u.user_id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                          )}
                          {showArchived && user.role === "ADMIN" && (
                            <>
                              <button onClick={() => handleRestore(u.user_id)} className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-600 transition-colors" title="Pulihkan"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={() => handlePurge(u.user_id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Hapus Permanen"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr></>
                  );
                });
              })()}
              {filtered.length === 0 && (
                <tr><td colSpan={activeTab === "ADMIN" ? 5 : 7} className="py-8 text-center text-muted-foreground">{loadingUsers ? "Memuat..." : `Belum ada user dengan role ${activeTab}`}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-card rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
              <h3 className="text-lg font-bold">Tambah User Baru</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-5 pt-4 flex-shrink-0">
              <Tabs value={addMode} onValueChange={(v) => setAddMode(v as AddMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="satuan" className="flex-1 gap-1.5"><UserPlus className="w-3.5 h-3.5" />Satuan</TabsTrigger>
                  <TabsTrigger value="batch" className="flex-1 gap-1.5"><Users className="w-3.5 h-3.5" />Batch</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" />Upload CSV</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="p-5 overflow-y-auto flex-1 min-h-0">
              {addMode === "satuan" && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); if (!saving) handleSaveSingle(); }}
                >
                  <div>
                    <label className={labelClass}>Role <span className="text-destructive">*</span></label>
                    <select
                      value={singleForm.role}
                      onChange={(e) => setSingleForm((f) => ({ ...f, role: e.target.value as TabRole, kelas: [], mapel: [] }))}
                      className={inputClass}
                    >
                      {allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label className={labelClass}>Username <span className="text-destructive">*</span></label><input value={singleForm.username} onChange={(e) => setSingleForm((f) => ({ ...f, username: e.target.value }))} className={inputClass} placeholder="Masukkan username" autoComplete="off" /></div>
                  <div>
                    <label className={labelClass}>Password <span className="text-destructive">*</span></label>
                    <div className="relative">
                      <input
                        type={showSinglePassword ? "text" : "password"}
                        value={singleForm.password}
                        onChange={(e) => setSingleForm((f) => ({ ...f, password: e.target.value }))}
                        className={cn(inputClass, "pr-10")}
                        placeholder="Masukkan password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSinglePassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        tabIndex={-1}
                        aria-label={showSinglePassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showSinglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div><label className={labelClass}>Nama Lengkap <span className="text-destructive">*</span></label><input value={singleForm.nama} onChange={(e) => setSingleForm((f) => ({ ...f, nama: e.target.value }))} className={inputClass} placeholder="Masukkan nama lengkap" /></div>
                  {singleForm.role !== "ADMIN" && (
                    <div><label className={labelClass}>Kelas <span className="text-destructive">*</span></label>
                      {singleForm.role === "SISWA" ? (
                        <select value={singleForm.kelas[0] || ""} onChange={(e) => setSingleForm((f) => ({ ...f, kelas: e.target.value ? [e.target.value] : [] }))} className={inputClass}>
                          <option value="">Pilih kelas...</option>
                          {availableKelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                        </select>
                      ) : (
                        <MultiSelectDropdown options={availableKelasList} selected={singleForm.kelas} onChange={(v) => setSingleForm((f) => ({ ...f, kelas: v }))} placeholder="Pilih kelas..." />
                      )}
                    </div>
                  )}
                  {singleForm.role === "GURU" && (
                    <div><label className={labelClass}>Mata Pelajaran <span className="text-destructive">*</span></label><MultiSelectDropdown options={availableMapelList} selected={singleForm.mapel} onChange={(v) => setSingleForm((f) => ({ ...f, mapel: v }))} placeholder="Pilih mata pelajaran..." /></div>
                  )}
                  <button type="submit" className="hidden" />
                </form>
              )}

              {addMode === "batch" && (
                <div className="space-y-4">
                  {batchStep === 1 ? (
                    <>
                      <div><label className={labelClass}>Role untuk semua user</label><select value={batchRole} onChange={(e) => setBatchRole(e.target.value as TabRole)} className={inputClass}>{allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                      <div><label className={labelClass}>Daftar Nama (satu nama per baris)</label><textarea value={batchNamaText} onChange={(e) => setBatchNamaText(e.target.value)} className={cn(inputClass, "min-h-[120px] resize-y")} placeholder={"Andi Pratama\nBudi Cahyono\nCitra Dewi"} /><p className="text-xs text-muted-foreground mt-1">Copy-paste daftar nama, satu nama per baris</p></div>
                      <div><label className={labelClass}>Kelas</label>
                        {batchRole === "SISWA" ? (
                          <select value={batchKelas[0] || ""} onChange={(e) => setBatchKelas(e.target.value ? [e.target.value] : [])} className={inputClass}>
                            <option value="">Pilih kelas...</option>
                            {availableKelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                          </select>
                        ) : (
                          <MultiSelectDropdown options={availableKelasList} selected={batchKelas} onChange={setBatchKelas} placeholder="Pilih kelas..." />
                        )}
                      </div>
                      {batchRole !== "SISWA" && (
                        <div><label className={labelClass}>Mata Pelajaran</label><MultiSelectDropdown options={availableMapelList} selected={batchMapel} onChange={setBatchMapel} placeholder="Pilih mata pelajaran..." /></div>
                      )}
                      <div>
                        <label className={labelClass}>Username & Password</label>
                        <div className="flex gap-3">
                          <label className={cn("flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all", batchUsernameMode === "system" ? "border-primary bg-primary/5" : "border-input hover:border-primary/50")}>
                            <input type="radio" name="usernameMode" checked={batchUsernameMode === "system"} onChange={() => setBatchUsernameMode("system")} className="accent-primary" />
                            <div><p className="text-sm font-medium">Generate Otomatis</p><p className="text-xs text-muted-foreground">Username & password digenerate sistem</p></div>
                          </label>
                          <label className={cn("flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all", batchUsernameMode === "nama" ? "border-primary bg-primary/5" : "border-input hover:border-primary/50")}>
                            <input type="radio" name="usernameMode" checked={batchUsernameMode === "nama"} onChange={() => setBatchUsernameMode("nama")} className="accent-primary" />
                            <div><p className="text-sm font-medium">Dari Nama</p><p className="text-xs text-muted-foreground">Username & password dari nama asli</p></div>
                          </label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Preview — {batchParsed.length} user</h4>
                        <button onClick={() => setBatchStep(1)} className="text-xs text-primary hover:text-primary/80 font-medium">← Kembali</button>
                      </div>
                      <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-muted/50 sticky top-0"><th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">No</th><th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Nama</th><th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Username</th><th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Password</th></tr></thead>
                          <tbody>{batchParsed.map((p, i) => (<tr key={i} className="border-t"><td className="py-2 px-3 text-muted-foreground">{i + 1}</td><td className="py-2 px-3 font-medium">{p.nama}</td><td className="py-2 px-3 font-mono text-xs">{p.username}</td><td className="py-2 px-3 font-mono text-xs">{p.password}</td></tr>))}</tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {addMode === "upload" && (
                <div className="space-y-4">
                  <div><label className={labelClass}>Role untuk semua user</label><select value={uploadRole} onChange={(e) => setUploadRole(e.target.value as TabRole)} className={inputClass}>{allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div>
                    <label className={labelClass}>Download Template</label>
                    <button onClick={handleDownloadTemplate} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"><Download className="w-4 h-4" />Download template_user.csv</button>
                    <p className="text-xs text-muted-foreground mt-1">Format kolom: <span className="font-mono">nama_lengkap, kelas, mapel, username, password</span></p>
                  </div>
                  <div>
                    <label className={labelClass}>Upload File CSV</label>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-input rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      {uploadedFile ? <p className="text-sm font-medium">{uploadedFile.name}</p> : <><p className="text-sm font-medium">Klik untuk memilih file</p><p className="text-xs text-muted-foreground mt-1">Format: CSV (.csv)</p></>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t justify-end flex-shrink-0">
              <button onClick={closeModal} className="px-4 py-2.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">Batal</button>
              {addMode === "batch" && batchStep === 1 ? (
                <button onClick={handleParseBatch} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md">Lanjutkan</button>
              ) : (
                <button disabled={saving} onClick={addMode === "satuan" ? handleSaveSingle : addMode === "batch" ? handleSaveBatch : handleUploadSave}
                  className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50">
                  {saving && batchProgress ? `Menyimpan ${batchProgress.current}/${batchProgress.total}...` : saving ? "Menyimpan..." : addMode === "upload" ? "Upload & Simpan" : "Simpan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">Edit User — {editUser.role}</h3>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className={labelClass}>Username</label><input value={editForm.username} onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>Nama Lengkap</label><input value={editForm.nama} onChange={(e) => setEditForm((f) => ({ ...f, nama: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>Kelas</label>
                {editUser.role === "SISWA" ? (
                  <select value={editForm.kelas[0] || ""} onChange={(e) => setEditForm((f) => ({ ...f, kelas: e.target.value ? [e.target.value] : [] }))} className={inputClass}>
                    <option value="">Pilih kelas...</option>
                    {availableKelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                  </select>
                ) : (
                  <MultiSelectDropdown options={availableKelasList} selected={editForm.kelas} onChange={(v) => setEditForm((f) => ({ ...f, kelas: v }))} placeholder="Pilih kelas..." />
                )}
              </div>
              <div><label className={labelClass}>Mata Pelajaran</label><MultiSelectDropdown options={availableMapelList} selected={editForm.mapel} onChange={(v) => setEditForm((f) => ({ ...f, mapel: v }))} placeholder="Pilih mata pelajaran..." /></div>
              <div><label className={labelClass}>Password Baru (kosongkan jika tidak diubah)</label><input type="text" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} placeholder="Masukkan password baru" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t justify-end">
              <button onClick={() => setEditUser(null)} className="px-4 py-2.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">Batal</button>
              <button onClick={handleSaveEdit} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div><h3 className="font-bold">Hapus User</h3><p className="text-sm text-muted-foreground">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button onClick={confirmDelete} disabled={saving} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50">{saving ? "Menghapus..." : "Hapus"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive (soft-delete) Confirmation */}
      {archiveConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setArchiveConfirmId(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center"><Archive className="w-5 h-5 text-amber-600" /></div>
              <div><h3 className="font-bold">Arsipkan {(() => { const u = users.find((x) => x.user_id === archiveConfirmId); return u?.role === "SISWA" ? "Siswa" : u?.role === "GURU" ? "Guru" : "User"; })()}</h3><p className="text-sm text-muted-foreground">Akun dinonaktifkan. Nilai tetap utuh & dapat dipulihkan.</p></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveConfirmId(null)} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button onClick={confirmArchive} disabled={saving} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold disabled:opacity-50">{saving ? "Memproses..." : "Arsipkan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Confirmation */}
      {purgeConfirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPurgeConfirmId(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div><h3 className="font-bold">Hapus Permanen</h3><p className="text-sm text-muted-foreground">Akun & SEMUA nilai {(() => { const u = users.find((x) => x.user_id === purgeConfirmId); return u?.role === "SISWA" ? "siswa" : u?.role === "GURU" ? "guru" : "user"; })()} akan hilang selamanya. Tidak bisa dipulihkan.</p></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPurgeConfirmId(null)} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button onClick={confirmPurge} disabled={saving} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50">{saving ? "Menghapus..." : "Hapus Permanen"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk archive/restore by kelas */}
      {bulkKelasAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBulkKelasAction(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                bulkKelasAction.mode === "archive" ? "bg-amber-500/10" : bulkKelasAction.mode === "restore" ? "bg-green-500/10" : "bg-destructive/10")}>
                {bulkKelasAction.mode === "archive"
                  ? <Archive className="w-5 h-5 text-amber-600" />
                  : bulkKelasAction.mode === "restore"
                    ? <Undo2 className="w-5 h-5 text-green-600" />
                    : <Trash2 className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <h3 className="font-bold">
                  {bulkKelasAction.mode === "archive" ? "Arsipkan" : bulkKelasAction.mode === "restore" ? "Pulihkan" : "Hapus Permanen"} {bulkKelasAction.all ? "Semua Siswa dari Semua Kelas" : `Semua Siswa Kelas ${bulkKelasAction.kelas}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {bulkKelasAction.count} akun siswa akan {bulkKelasAction.mode === "archive" ? "diarsipkan" : bulkKelasAction.mode === "restore" ? "dipulihkan" : "dihapus permanen"}.
                  {bulkKelasAction.mode === "archive" && " Nilai tetap utuh dan dapat dipulihkan kapan saja."}
                  {bulkKelasAction.mode === "delete" && " Akun dan nilai siswa akan hilang selamanya."}
                </p>
              </div>
            </div>
            {bulkKelasAction.mode === "delete" && (() => {
              const confirmKey = bulkKelasAction.all ? "HAPUS SEMUA" : bulkKelasAction.kelas;
              return (
                <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs text-destructive font-medium mb-2">
                    Aksi ini <span className="font-bold">TIDAK BISA dibatalkan</span>. Untuk konfirmasi, ketik persis: <span className="font-mono font-bold">{confirmKey}</span>
                  </p>
                  <input
                    type="text"
                    value={bulkConfirmText}
                    onChange={(e) => setBulkConfirmText(e.target.value)}
                    placeholder={`Ketik "${confirmKey}"`}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive"
                    autoFocus
                  />
                </div>
              );
            })()}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setBulkKelasAction(null); setBulkConfirmText(""); }} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button
                onClick={confirmBulkKelas}
                disabled={saving || (bulkKelasAction.mode === "delete" && bulkConfirmText.trim() !== (bulkKelasAction.all ? "HAPUS SEMUA" : bulkKelasAction.kelas))}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed",
                  bulkKelasAction.mode === "archive" ? "bg-amber-500" : bulkKelasAction.mode === "restore" ? "bg-green-600" : "bg-destructive")}
              >
                {saving ? "Memproses..." : (bulkKelasAction.mode === "archive" ? "Arsipkan Semua" : bulkKelasAction.mode === "restore" ? "Pulihkan Semua" : "Hapus Permanen Semua")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk archive/restore by role */}
      {bulkRoleAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBulkRoleAction(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center",
                bulkRoleAction.mode === "archive" ? "bg-amber-500/10" : bulkRoleAction.mode === "restore" ? "bg-green-500/10" : "bg-destructive/10")}>
                {bulkRoleAction.mode === "archive"
                  ? <Archive className="w-5 h-5 text-amber-600" />
                  : bulkRoleAction.mode === "restore"
                    ? <Undo2 className="w-5 h-5 text-green-600" />
                    : <Trash2 className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <h3 className="font-bold">
                  {bulkRoleAction.mode === "archive" ? "Arsipkan" : bulkRoleAction.mode === "restore" ? "Pulihkan" : "Hapus Permanen"} Semua {bulkRoleAction.role === "SISWA" ? "Siswa" : bulkRoleAction.role === "GURU" ? "Guru" : "User"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {bulkRoleAction.count} akun {bulkRoleAction.role === "SISWA" ? "siswa" : bulkRoleAction.role === "GURU" ? "guru" : "user"} akan {bulkRoleAction.mode === "archive" ? "diarsipkan" : bulkRoleAction.mode === "restore" ? "dipulihkan" : "dihapus permanen"}.
                  {bulkRoleAction.mode === "archive" && " Nilai tetap utuh dan dapat dipulihkan kapan saja."}
                  {bulkRoleAction.mode === "delete" && " Akun dan nilai akan hilang selamanya."}
                </p>
              </div>
            </div>
            {bulkRoleAction.mode === "delete" && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-xs text-destructive font-medium mb-2">
                  Aksi ini <span className="font-bold">TIDAK BISA dibatalkan</span>. Untuk konfirmasi, ketik persis: <span className="font-mono font-bold">HAPUS SEMUA {bulkRoleAction.role}</span>
                </p>
                <input
                  type="text"
                  value={bulkConfirmText}
                  onChange={(e) => setBulkConfirmText(e.target.value)}
                  placeholder={`Ketik "HAPUS SEMUA ${bulkRoleAction.role}"`}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive"
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setBulkRoleAction(null); setBulkConfirmText(""); }} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button
                onClick={confirmBulkRole}
                disabled={saving || (bulkRoleAction.mode === "delete" && bulkConfirmText.trim() !== `HAPUS SEMUA ${bulkRoleAction.role}`)}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed",
                  bulkRoleAction.mode === "archive" ? "bg-amber-500" : bulkRoleAction.mode === "restore" ? "bg-green-600" : "bg-destructive")}
              >
                {saving ? "Memproses..." : (bulkRoleAction.mode === "archive" ? "Arsipkan Semua" : bulkRoleAction.mode === "restore" ? "Pulihkan Semua" : "Hapus Permanen Semua")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
              <div><h3 className="font-bold">Hapus Semua {bulkDeleteRole}</h3><p className="text-sm text-muted-foreground">Semua user dengan role {bulkDeleteRole} akan dihapus</p></div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowBulkDeleteModal(false)} className="px-4 py-2 rounded-lg bg-muted text-sm font-medium">Batal</button>
              <button onClick={confirmBulkDelete} disabled={saving} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50">{saving ? "Menghapus..." : "Hapus Semua"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Created User Info Modal */}
      {createdUserInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreatedUserInfo(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Check className="w-5 h-5 text-primary" /></div>
              <div><h3 className="font-bold">User Berhasil Dibuat</h3><p className="text-sm text-muted-foreground">Simpan informasi login berikut</p></div>
            </div>
            <div className="space-y-3 mb-5">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nama</p>
                <p className="text-sm font-medium">{createdUserInfo.nama}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Username</p>
                  <p className="text-sm font-mono font-medium">{createdUserInfo.username}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(createdUserInfo.username); setCopiedField("username"); setTimeout(() => setCopiedField(null), 2000); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  {copiedField === "username" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Password</p>
                  <p className="text-sm font-mono font-medium">{createdUserInfo.password}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(createdUserInfo.password); setCopiedField("password"); setTimeout(() => setCopiedField(null), 2000); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  {copiedField === "password" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <button onClick={() => setCreatedUserInfo(null)} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all">Tutup</button>
          </div>
        </div>
      )}

      {/* Konfirmasi nama duplikat — pengguna memutuskan tetap simpan atau batal */}
      {dupConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-start gap-3 p-5 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">Nama duplikat terdeteksi</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Jika akun sudah ada, kelas dan mata pelajaran baru akan ditambahkan ke akun tersebut tanpa membuat akun ganda. Lanjutkan?</p>
              </div>
              <button onClick={() => setDupConfirm(null)} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {dupConfirm.existing.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Sudah tersimpan di database ({dupConfirm.existing.length})
                  </p>
                  <ul className="space-y-1.5">
                    {dupConfirm.existing.map((d, i) => (
                      <li key={i} className="flex flex-col gap-0.5 p-2.5 rounded-md bg-muted/50 border border-border">
                        <span className="font-medium">"{d.nama}"</span>
                        <span className="text-xs text-muted-foreground">Tersimpan sebagai <span className="font-medium text-foreground">{d.location}</span> · username: <span className="font-mono">{d.username}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dupConfirm.inside.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Duplikat dalam daftar yang akan ditambahkan ({dupConfirm.inside.length})
                  </p>
                  <ul className="space-y-1.5">
                    {dupConfirm.inside.map((d, i) => (
                      <li key={i} className="flex items-center justify-between p-2.5 rounded-md bg-muted/50 border border-border">
                        <span className="font-medium">"{d.nama}"</span>
                        <span className="text-xs text-muted-foreground">muncul {d.count}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button
                onClick={() => setDupConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-input hover:bg-muted text-sm font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => dupConfirm.onConfirm()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 text-sm font-semibold transition-all"
              >
                Tetap Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {guruReject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-start gap-3 p-5 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">Penambahan guru ditolak</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Mata pelajaran berikut sudah diajar oleh guru lain pada kelas yang sama. Satu mata pelajaran hanya boleh diajar oleh satu guru per kelas.</p>
              </div>
              <button onClick={() => setGuruReject(null)} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2 text-sm">
              <ul className="space-y-1.5">
                {guruReject.conflicts.map((c, i) => (
                  <li key={i} className="flex flex-col gap-0.5 p-2.5 rounded-md bg-destructive/5 border border-destructive/30">
                    <span className="font-medium">{c.mapel} · Kelas {c.kelas}</span>
                    <span className="text-xs text-muted-foreground">
                      Sudah diajar oleh <span className="font-medium text-foreground">{c.guru}</span> (<span className="font-mono">{c.username}</span>)
                      {c.namaBaru ? <> · calon guru: <span className="font-medium text-foreground">{c.namaBaru}</span></> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-2">Solusi: ubah pilihan kelas atau mata pelajaran, atau pindahkan penugasan dari guru sebelumnya terlebih dahulu.</p>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button
                onClick={() => setGuruReject(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 text-sm font-semibold transition-all"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
