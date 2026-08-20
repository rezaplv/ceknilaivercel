import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, Medal, Award, Sparkles, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  kelasId: string;
  mapelId: string;
  jenis: "SUMATIF" | "STS" | "SAS";
  namaPenilaian: string;
  myName?: string;
};

type RankRow = { rank: number; nama_lengkap: string; nilai: number };

function useRankingData(kelasId: string, mapelId: string, jenis: string, namaPenilaian: string) {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .rpc("get_top_ranking", {
        _kelas_id: kelasId,
        _mapel_id: mapelId,
        _jenis: jenis,
        _nama_penilaian: namaPenilaian,
      })
      .then(({ data }) => {
        if (!mounted) return;
        setRows((data as RankRow[]) || []);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [kelasId, mapelId, jenis, namaPenilaian]);

  return { rows, loading };
}

export function StudentRanking({ kelasId, mapelId, jenis, namaPenilaian, myName }: Props) {
  const { rows, loading } = useRankingData(kelasId, mapelId, jenis, namaPenilaian);
  const containerRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  const grouped = useMemo(() => {
    const map = new Map<number, RankRow[]>();
    (rows || []).forEach((r) => {
      if (!map.has(r.rank)) map.set(r.rank, []);
      map.get(r.rank)!.push(r);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rows]);

  const iAmOnPodium = useMemo(
    () => !!myName && (rows || []).some((r) => r.nama_lengkap === myName),
    [rows, myName]
  );

  // Reset penanda kembang api setiap kali penilaian berganti
  useEffect(() => {
    firedRef.current = false;
  }, [kelasId, mapelId, jenis, namaPenilaian]);

  // Fireworks ketika podium muncul — hanya jika siswa benar-benar masuk podium
  useEffect(() => {
    if (loading || !rows || rows.length === 0 || firedRef.current) return;
    if (typeof window === "undefined") return;
    // Jangan tampilkan kembang api jika siswa tidak masuk peringkat
    if (!iAmOnPodium) return;
    firedRef.current = true;

    const rect = containerRef.current?.getBoundingClientRect();
    const originY = rect ? Math.min(0.85, (rect.top + rect.height / 2) / window.innerHeight) : 0.6;

    const colors = ["#f59e0b", "#fbbf24", "#fde047", "#10b981", "#3b82f6", "#ef4444"];
    const burst = (x: number) => {
      confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 45,
        origin: { x, y: originY },
        colors,
        scalar: 1.05,
        ticks: 220,
      });
    };
    burst(0.25);
    setTimeout(() => burst(0.75), 220);
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 120,
        startVelocity: 55,
        origin: { x: 0.5, y: originY },
        colors,
        shapes: ["star", "circle"],
        scalar: 1.2,
        ticks: 260,
      });
    }, 500);
  }, [loading, rows, iAmOnPodium, kelasId, mapelId, jenis, namaPenilaian]);

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-5 text-center text-sm text-muted-foreground">
        Memuat ranking…
      </div>
    );
  }

  if (!rows || rows.length === 0) return null;

  const notRanked = myName && !rows.some((r) => r.nama_lengkap === myName);

  const getRankMeta = (rank: number) => {
    if (rank === 1) {
      return {
        label: "Juara 1",
        colorClass: "from-amber-400 to-yellow-500",
        darkColorClass: "dark:from-amber-500 dark:to-yellow-600",
        textClass: "text-amber-950 dark:text-amber-100",
        icon: Crown,
        ring: "ring-amber-400 dark:ring-amber-300",
        crown: true,
      };
    }
    if (rank === 2) {
      return {
        label: "Juara 2",
        colorClass: "from-slate-300 to-slate-400",
        darkColorClass: "dark:from-slate-400 dark:to-slate-500",
        textClass: "text-slate-900 dark:text-slate-100",
        icon: Medal,
        ring: "ring-slate-300 dark:ring-slate-400",
        crown: false,
      };
    }
    return {
      label: "Juara 3",
      colorClass: "from-orange-300 to-amber-600",
      darkColorClass: "dark:from-orange-500 dark:to-amber-700",
      textClass: "text-orange-950 dark:text-orange-100",
      icon: Award,
      ring: "ring-orange-400 dark:ring-orange-300",
      crown: false,
    };
  };

  const rankMap = new Map(grouped);

  const RankColumn = ({ rank }: { rank: number }) => {
    const list = rankMap.get(rank);
    const [expanded, setExpanded] = useState(false);
    if (!list) return null;
    const meta = getRankMeta(rank);
    const Icon = meta.icon;

    const MAX_VISIBLE = 2;
    const overflow = list.length > MAX_VISIBLE;
    const visible = expanded || !overflow ? list : list.slice(0, MAX_VISIBLE);
    const hiddenCount = list.length - MAX_VISIBLE;

    return (
      <div className="flex flex-col items-center w-full min-w-0">
        {/* Card */}
        <div
          className={cn(
            "relative z-10 w-full rounded-xl sm:rounded-2xl bg-card border-2 p-2 sm:p-3 lg:p-4 shadow-lg sm:shadow-xl transition-transform hover:scale-[1.02]",
            meta.ring
          )}
        >
          {meta.crown && (
            <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/40 animate-[bounce_2s_ease-in-out_infinite]">
                <Crown className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white drop-shadow" strokeWidth={2} />
              </div>
            </div>
          )}

          <div className="flex flex-col items-center text-center">
            {/* Rank badge */}
            <div
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md mb-1.5 sm:mb-2",
                meta.colorClass,
                meta.darkColorClass
              )}
            >
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white drop-shadow", rank === 1 && "w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7")} strokeWidth={2} />
            </div>

            {/* Label */}
            <p className={cn("text-[9px] sm:text-[10px] lg:text-xs font-extrabold uppercase tracking-wider mb-0.5 sm:mb-1", meta.textClass)}>
              {meta.label}
            </p>

            {/* Count badge if many */}
            {list.length > 1 && (
              <span className="mb-1 sm:mb-1.5 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-muted text-muted-foreground">
                {list.length} siswa
              </span>
            )}

            {/* Names */}
            <div className={cn(
              "w-full divide-y divide-border/40",
              list.length > 3 && !expanded ? "max-h-20 sm:max-h-24 overflow-hidden" : "max-h-32 sm:max-h-40 overflow-y-auto pr-0.5 sm:pr-1"
            )}>
              {visible.map((r, idx) => {
                const me = myName && r.nama_lengkap === myName;
                return (
                  <p
                    key={`${r.nama_lengkap}-${idx}`}
                    className={cn(
                      "py-1 sm:py-1.5 text-[10px] sm:text-[11px] lg:text-xs font-medium leading-snug text-center truncate px-0.5",
                      me ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/90"
                    )}
                  >
                    {r.nama_lengkap} {me && <span className="inline-block ml-0.5 flex-shrink-0">⭐</span>}
                  </p>
                );
              })}
            </div>

            {overflow && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] font-semibold text-primary hover:underline"
              >
                {expanded ? "Sembunyikan" : `+${hiddenCount} lainnya`}
              </button>
            )}
          </div>
        </div>

        {/* Pedestal */}
        <div
          className={cn(
            "relative w-[85%] sm:w-[70%] mt-2 sm:mt-3 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 flex items-center justify-center gap-1",
            "bg-gradient-to-r shadow-md sm:shadow-lg backdrop-blur-sm border border-white/30 dark:border-white/10",
            meta.colorClass,
            meta.darkColorClass
          )}
        >
          <span className="text-[9px] sm:text-[10px] font-extrabold text-white uppercase tracking-[0.15em] sm:tracking-[0.2em] drop-shadow-sm">
            #{rank}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-amber-300/60 dark:border-amber-500/30 p-3 sm:p-4 lg:p-6 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/40"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -top-10 -left-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-amber-300/40 blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-36 sm:w-44 h-36 sm:h-44 rounded-full bg-rose-300/40 blur-3xl animate-pulse [animation-delay:600ms]" />
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Icon */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-md sm:rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-md shadow-amber-500/30 flex-shrink-0">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px] text-white" strokeWidth={2} />
          </div>
          {/* Title stack */}
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm lg:text-[15px] font-bold text-foreground leading-tight tracking-tight truncate">
              Top 3 Peringkat
            </h3>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-muted-foreground font-medium truncate mt-0.5">
              {namaPenilaian}
            </p>
          </div>
        </div>

        {iAmOnPodium && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Anda masuk peringkat
          </span>
        )}
      </div>

      {/* Podium */}
      <div className="relative flex items-end justify-center gap-1.5 sm:gap-4 md:gap-6">
        {/* Rank 2 — left */}
        <div className="flex-1 min-w-0 flex justify-end">
          <div className="w-full max-w-[140px] sm:max-w-[180px] lg:max-w-[200px]">
            <RankColumn rank={2} />
          </div>
        </div>

        {/* Rank 1 — center */}
        <div className="flex-1 min-w-0 flex justify-center z-10">
          <div className="w-full max-w-[150px] sm:max-w-[200px] lg:max-w-[220px]">
            <RankColumn rank={1} />
          </div>
        </div>

        {/* Rank 3 — right */}
        <div className="flex-1 min-w-0 flex justify-start">
          <div className="w-full max-w-[140px] sm:max-w-[180px] lg:max-w-[200px]">
            <RankColumn rank={3} />
          </div>
        </div>
      </div>

      {/* Not-ranked message */}
      {notRanked && (
        <div className="relative mt-4 sm:mt-5 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" strokeWidth={2} />
            <span className="text-[10px] sm:text-xs font-semibold text-center leading-snug">
              Anda belum masuk peringkat untuk penilaian ini.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
