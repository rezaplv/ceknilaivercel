import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  kelasId: string | null;
  mapelId: string | null;
  kelasNama?: string;
  mapelNama?: string;
};

export function RankingToggle({ kelasId, mapelId, kelasNama, mapelNama }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kelasId || !mapelId) return;
    setLoading(true);
    supabase
      .from("ranking_settings")
      .select("enabled")
      .eq("kelas_id", kelasId)
      .eq("mapel_id", mapelId)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(!!data?.enabled);
        setLoading(false);
      });
  }, [kelasId, mapelId]);

  const toggle = async () => {
    if (!kelasId || !mapelId || saving) return;
    const next = !enabled;
    setSaving(true);
    const { data: existing } = await supabase
      .from("ranking_settings")
      .select("id")
      .eq("kelas_id", kelasId)
      .eq("mapel_id", mapelId)
      .maybeSingle();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("ranking_settings")
        .update({ enabled: next, updated_by: authUser?.id })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("ranking_settings")
        .insert({ kelas_id: kelasId, mapel_id: mapelId, enabled: next, updated_by: authUser?.id }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return;
    }
    setEnabled(next);
    toast({
      title: next ? "🏆 Ranking diaktifkan" : "Ranking dinonaktifkan",
      description: next
        ? `Siswa di ${kelasNama || "kelas ini"} bisa melihat 3 peringkat teratas mapel ${mapelNama || "ini"}.`
        : `Siswa tidak akan melihat ranking mapel ${mapelNama || "ini"}.`,
    });
  };

  if (!kelasId || !mapelId) return null;

  return (
    <div className="bg-card border rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
          <Trophy className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Ranking Siswa</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tampilkan 3 peringkat teratas (Sumatif, STS, SAS) untuk siswa di kelas + mapel ini.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading || saving}
        aria-pressed={enabled}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          enabled ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
