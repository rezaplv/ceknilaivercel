import { useState, useEffect, useCallback, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, BookOpen, Sparkles, ChevronRight, GraduationCap, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getJenisLabel } from "@/lib/jenisLabels";
import { StudentRanking } from "@/components/StudentRanking";

type JenisRanking = "SUMATIF" | "STS" | "SAS";

export default function PapanPeringkat() {
  const { user } = useAuth();
  usePageTitle("Papan Peringkat");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedJenis, setSelectedJenis] = useState<JenisRanking | "">("");
  const [selectedSumatif, setSelectedSumatif] = useState<string>("");
  const [allScores, setAllScores] = useState<any[]>([]);
  const [mapelNames, setMapelNames] = useState<string[]>([]);

  const loadScores = useCallback(() => {
    if (user && user.role === "SISWA") {
      supabase
        .from("scores")
        .select("id, kelas_id, mapel_id, jenis, nama_penilaian, kelas(nama), mapel(nama)")
        .eq("student_id", user.user_id)
        .in("jenis", ["SUMATIF", "STS", "SAS"])
        .then(({ data }) => setAllScores(data || []));
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === "SISWA") {
      loadScores();
      const channel = supabase
        .channel("student-ranking-scores")
        .on("postgres_changes", {
          event: "*", schema: "public", table: "scores",
          filter: `student_id=eq.${user.user_id}`,
        }, () => loadScores())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, loadScores]);

  // Gabungkan mapel dari profil dengan mapel yang sudah memiliki nilai
  useEffect(() => {
    if (!user || user.role !== "SISWA") return;
    const fromScores = allScores.map((s: any) => s.mapel?.nama).filter(Boolean) as string[];
    const merged = [...new Set([...(user.mapel || []), ...fromScores])].sort(
      (a, b) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" })
    );
    setMapelNames(merged);
  }, [user, allScores]);

  const mapelScores = useMemo(
    () => allScores.filter((s: any) => s.mapel?.nama === selectedMapel),
    [allScores, selectedMapel]
  );

  const availableJenis: JenisRanking[] = ["SUMATIF", "STS", "SAS"];

  const penilaianList = useMemo(() => {
    if (!selectedJenis) return [] as { nama: string; kelas_id: string; mapel_id: string }[];
    const seen = new Set<string>();
    const out: { nama: string; kelas_id: string; mapel_id: string }[] = [];
    for (const s of mapelScores) {
      if (s.jenis !== selectedJenis) continue;
      const key = s.nama_penilaian;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ nama: key, kelas_id: s.kelas_id, mapel_id: s.mapel_id });
    }
    return out;
  }, [mapelScores, selectedJenis]);

  if (!user || user.role !== "SISWA") return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/40">
            <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Papan Peringkat</h2>
        </div>
        <p className="text-sm text-foreground/70 mt-2.5 pl-3 border-l-[3px] border-primary font-medium">
          Tiga peringkat teratas per penilaian untuk Kelas {user.kelas?.[0] || "Belum diatur"}
        </p>
      </div>

      {/* Pilih Mata Pelajaran */}
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
                  onClick={() => { setSelectedMapel(m); setSelectedJenis(""); setSelectedSumatif(""); }}
                  disabled={!hasData}
                  className={cn(
                    "group relative flex items-center gap-3 p-4 text-left transition-all duration-300 w-full rounded-xl",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-white border-2 border-primary shadow-lg shadow-primary/30"
                      : hasData
                        ? "border-2 border-border/60 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 text-foreground"
                        : "bg-muted/40 border-2 border-transparent opacity-50 cursor-not-allowed"
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
                    <p className={cn("font-semibold text-sm truncate", isActive ? "text-white" : "text-foreground")}>{m}</p>
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

      {/* Pilih Jenis Penilaian */}
      {selectedMapel && (
        <div className="border border-border/50 rounded-xl p-5 md:p-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jenis Penilaian untuk <span className="text-foreground">{selectedMapel}</span>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-fr">
            {availableJenis.map((j) => {
              const count = mapelScores.filter((s: any) => s.jenis === j).length;
              const hasData = count > 0;
              const isActive = selectedJenis === j;
              return (
                <div key={j} className="h-full">
                  <button
                    onClick={() => { hasData && setSelectedJenis(j); setSelectedSumatif(""); }}
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
                        isActive ? "text-white" : hasData ? "text-foreground" : "text-muted-foreground"
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

      {/* Pilih Sumatif */}
      {selectedMapel && selectedJenis === "SUMATIF" && penilaianList.length > 0 && (
        <div className="border border-border/50 rounded-xl p-5 md:p-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Medal className="w-4 h-4 text-white" />
            </div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pilih Sumatif
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {penilaianList.map((p) => {
              const isActive = selectedSumatif === p.nama;
              return (
                <button
                  key={p.nama}
                  onClick={() => setSelectedSumatif(p.nama)}
                  className={cn(
                    "group relative flex items-center gap-3 p-4 text-left transition-all duration-300 w-full rounded-xl",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-white border-2 border-primary shadow-lg shadow-primary/30"
                      : "border-2 border-border/60 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 text-foreground bg-card"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                    isActive ? "bg-white/20" : "bg-primary/10 group-hover:bg-primary/20"
                  )}>
                    <Medal className={cn("w-5 h-5", isActive ? "text-white" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm truncate", isActive ? "text-white" : "text-foreground")}>{p.nama}</p>
                    <span className={cn("text-xs", isActive ? "text-white/80" : "text-muted-foreground")}>Lihat peringkat</span>
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
              );
            })}
          </div>
          {!selectedSumatif && (
            <p className="text-xs text-muted-foreground mt-3">
              Pilih salah satu sumatif untuk melihat peringkatnya.
            </p>
          )}
        </div>
      )}

      {/* Ranking Results */}
      {selectedMapel && selectedJenis && (
        <div className="space-y-4">
          {(selectedJenis === "SUMATIF"
            ? penilaianList.filter((p) => p.nama === selectedSumatif)
            : penilaianList
          ).map((p) => (
            <StudentRanking
              key={`${selectedJenis}-${p.nama}`}
              kelasId={p.kelas_id}
              mapelId={p.mapel_id}
              jenis={selectedJenis}
              namaPenilaian={p.nama}
              myName={user.nama_lengkap}
            />
          ))}
          {penilaianList.length === 0 && (
            <div className="bg-card border rounded-xl p-8 text-center text-sm text-muted-foreground">
              Belum ada penilaian untuk jenis ini.
            </div>
          )}
        </div>
      )}

      {!selectedMapel && (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 md:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary/60" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">Pilih Mata Pelajaran</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Klik salah satu mata pelajaran di atas untuk melihat papan peringkat</p>
        </div>
      )}
    </div>
  );
}