import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, CheckCircle2, XCircle, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import { getJenisLabel } from "@/lib/jenisLabels";


type JenisNilai = "FORMATIF" | "SUMATIF" | "STS" | "SAS";

export default function HasilBelajar() {
  const { user } = useAuth();
  usePageTitle("Hasil Belajar");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedJenis, setSelectedJenis] = useState<JenisNilai | "">("");
  const [allScores, setAllScores] = useState<any[]>([]);
  const [mapelNames, setMapelNames] = useState<string[]>([]);

  const loadScores = useCallback(() => {
    if (user && user.role === "SISWA") {
      supabase
        .from("scores")
        .select("*, kelas(nama), mapel(nama)")
        .eq("student_id", user.user_id)
        .then(({ data }) => {
          setAllScores(data || []);
        });
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === "SISWA") {
      loadScores();

      // Realtime subscription for score changes
      const channel = supabase
        .channel('student-scores')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scores',
            filter: `student_id=eq.${user.user_id}`,
          },
          () => {
            loadScores();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, loadScores]);

  // Gabungkan mapel dari profil siswa dengan mapel yang sudah memiliki nilai,
  // agar mapel baru yang ditambahkan guru langsung muncul.
  useEffect(() => {
    if (!user || user.role !== "SISWA") return;
    const fromScores = allScores
      .map((s: any) => s.mapel?.nama)
      .filter(Boolean) as string[];
    const merged = [...new Set([...(user.mapel || []), ...fromScores])].sort(
      (a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" })
    );
    setMapelNames(merged);
  }, [user, allScores]);

  if (!user || user.role !== "SISWA") return null;

  const mapelScores = allScores.filter((s: any) => s.mapel?.nama === selectedMapel);
  const availableJenis: JenisNilai[] = ["FORMATIF", "SUMATIF", "STS", "SAS"];

  // Filter: hide non-visible formatif
  const displayScores = mapelScores
    .filter((s: any) => s.jenis === selectedJenis);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
            <BookOpen className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Hasil Belajar</h2>
        </div>
        <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Hasil belajar Anda untuk Kelas {user.kelas?.[0] || "Belum diatur"}
        </p>
      </div>

      <div className="border border-border/50 rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pilih Mata Pelajaran
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mapelNames.map((m) => {
            const hasData = allScores.some((s: any) => s.mapel?.nama === m);
            const isActive = selectedMapel === m;
            return (
              <div key={m}>
                <button
                  onClick={() => { setSelectedMapel(m); setSelectedJenis(""); }}
                  className={cn(
                    "group relative flex items-center gap-3 p-4 text-left transition-all duration-300 w-full rounded-xl",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-white border-2 border-primary shadow-lg shadow-primary/30"
                      : "border-2 border-border/60 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                    isActive
                      ? "bg-white/20"
                      : "bg-primary/10 group-hover:bg-primary/20"
                  )}>
                    <BookOpen className={cn("w-5 h-5", isActive ? "text-white" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm truncate text-shadow-strong", isActive ? "text-white" : "text-foreground")}>{m}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hasData ? (
                        <>
                          <span className={cn("w-2 h-2 rounded-full", isActive ? "bg-emerald-300" : "bg-emerald-500")} />
                          <span className={cn("text-xs", isActive ? "text-white/80" : "text-muted-foreground")}>Nilai tersedia</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                          <span className="text-xs text-muted-foreground/60">Belum ada nilai</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1",
                    isActive ? "text-white/70" : "text-muted-foreground/40"
                  )} />
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Sparkles className="w-3.5 h-3.5 text-white/50 animate-float" />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
          {mapelNames.length === 0 && (
            <div className="col-span-full py-8 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada mapel yang ditugaskan</p>
            </div>
          )}
        </div>
      </div>

      {selectedMapel && (
        <div className="border border-border/50 rounded-xl p-5 md:p-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jenis Nilai untuk <span className="text-foreground">{selectedMapel}</span>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 auto-rows-fr">
            {availableJenis.map((j) => {
              const count = mapelScores.filter((s: any) => s.jenis === j).length;
              const hasData = count > 0;
              const isActive = selectedJenis === j;
              return (
                <div key={j} className="h-full">
                  <button
                    onClick={() => hasData && setSelectedJenis(j)}
                    disabled={!hasData}
                    className={cn(
                      "group relative flex flex-col items-center justify-between h-full min-h-[100px] p-3 sm:p-4 w-full transition-all duration-300 rounded-xl",
                      "hover:scale-[1.03] active:scale-[0.97]",
                      isActive
                        ? "bg-primary text-white border-2 border-primary shadow-lg shadow-primary/30"
                        : hasData
                          ? "border-2 border-border/60 hover:border-accent/40 hover:shadow-md hover:shadow-accent/10 text-foreground bg-card"
                          : "bg-muted/40 border-2 border-transparent opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <Sparkles className="w-3 h-3 text-white/60 animate-float" />
                      </div>
                    )}
                    <div className="flex-1 flex items-center justify-center w-full">
                      <span className={cn(
                        "text-sm sm:text-base font-bold text-center leading-tight",
                        isActive ? "text-white text-shadow-strong" : hasData ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {getJenisLabel(j)}
                      </span>
                    </div>
                    <div className="mt-2 h-6 flex items-center justify-center shrink-0">
                      {hasData ? (
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                          isActive
                            ? "bg-white text-primary border-white shadow-sm"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40"
                        )}>
                          {count} nilai
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">Belum ada</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedMapel && selectedJenis && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold">{selectedMapel}: Nilai {getJenisLabel(selectedJenis)}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-12">No</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Nama Penilaian</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">KKM</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Nilai</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayScores.map((s: any, i: number) => {
                  // For SUMATIF/STS/SAS with nilai_asli set, show nilai_asli to students
                  const hasLockedValue = s.nilai_asli !== null && s.nilai_asli !== undefined && ["SUMATIF", "STS", "SAS"].includes(s.jenis);
                  const displayNilai = hasLockedValue ? Number(s.nilai_asli) : Number(s.nilai);
                  const belumMengerjakan = displayNilai < 0;
                  const isTuntas = belumMengerjakan ? false : s.nilai_type === "ceklis" ? displayNilai === 1 : displayNilai >= Number(s.kkm);
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{s.nama_penilaian}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{s.kkm}</td>
                      <td className="py-3 px-4 text-center">
                        {belumMengerjakan ? (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        ) : s.jenis === "FORMATIF" && !s.visible ? (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        ) : s.nilai_type === "ceklis" ? (
                          displayNilai === 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <XCircle className="w-5 h-5 text-destructive mx-auto" />
                        ) : (
                          <span className={cn("font-semibold", displayNilai < Number(s.kkm) ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{displayNilai}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {belumMengerjakan ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            Belum Mengerjakan
                          </span>
                        ) : s.jenis === "FORMATIF" && !s.visible ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                            Sudah Mengerjakan
                          </span>
                        ) : s.nilai_type !== "ceklis" && (
                          <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold",
                            isTuntas ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400")}>
                            {isTuntas ? "Tuntas" : "Belum Tuntas"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {displayScores.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada nilai {selectedJenis} untuk {selectedMapel}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {!selectedMapel && (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 md:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-primary/60" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">Pilih Mata Pelajaran</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Pilih salah satu mata pelajaran di atas untuk melihat detail nilai Anda.</p>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-lg">📋</span>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Informasi Penting</p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">
            Untuk pertanyaan seputar nilai atau program remedial, silakan hubungi guru pengampu mata pelajaran yang bersangkutan.
          </p>
        </div>
      </div>
    </div>
  );
}
