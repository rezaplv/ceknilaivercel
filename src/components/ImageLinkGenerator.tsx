import { useState } from "react";
import { ImageIcon, Link2, Trash2, Copy, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneratedLink {
  id: string;
  fileName: string;
  directLink: string;
  createdAt: string;
}

function extractFileId(url: string): string | null {
  // Match /file/d/FILE_ID/
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Match ?id=FILE_ID or &id=FILE_ID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Match /d/FILE_ID
  match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return null;
}

function getStoredLinks(): GeneratedLink[] {
  try {
    return JSON.parse(localStorage.getItem("generated_image_links") || "[]");
  } catch { return []; }
}

function saveStoredLinks(links: GeneratedLink[]) {
  localStorage.setItem("generated_image_links", JSON.stringify(links));
}

export default function ImageLinkGenerator() {
  const { toast } = useToast();
  const [driveUrl, setDriveUrl] = useState("");
  const [links, setLinks] = useState<GeneratedLink[]>(getStoredLinks);
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(0);

  const handleGenerate = () => {
    if (!driveUrl.trim()) {
      toast({ title: "Error", description: "Masukkan URL Google Drive terlebih dahulu", variant: "destructive" });
      return;
    }
    const fileId = extractFileId(driveUrl.trim());
    if (!fileId) {
      toast({ title: "Error", description: "URL tidak valid. Gunakan link share Google Drive.", variant: "destructive" });
      return;
    }
    const directLink = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    const newLink: GeneratedLink = {
      id: crypto.randomUUID(),
      fileName: `image_${fileId.slice(0, 8)}`,
      directLink,
      createdAt: new Date().toLocaleString("id-ID"),
    };
    const updated = [newLink, ...links];
    setLinks(updated);
    saveStoredLinks(updated);
    setDriveUrl("");
    toast({ title: "Berhasil", description: "Direct link berhasil di-generate" });
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Disalin", description: "Link berhasil disalin ke clipboard" });
  };

  const handleDelete = (id: string) => {
    const updated = links.filter((l) => l.id !== id);
    setLinks(updated);
    saveStoredLinks(updated);
  };

  const handleRefresh = () => {
    setLinks(getStoredLinks());
  };

  const filtered = links.filter((l) => l.fileName.toLowerCase().includes(search.toLowerCase()) || l.directLink.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Generator Card */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">Generator Link Gambar</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Ubah link Google Drive menjadi direct link siap pakai untuk logo & background.</p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-5 space-y-3">
          <label className="block text-xs font-semibold text-primary uppercase tracking-wider">URL File Google Drive</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="Paste Link File di sini..."
                className="w-full pl-10 pr-3 py-3 rounded-lg border bg-background text-sm"
              />
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all shadow-md whitespace-nowrap"
            >
              <Link2 className="w-4 h-4" />
              Hasilkan Link
            </button>
          </div>
        </div>
      </div>

      {/* History Card */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold">Riwayat Gambar Tersimpan</h3>
          <button onClick={handleRefresh} className="flex items-center gap-1.5 text-sm text-primary hover:underline flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span>Show</span>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }} className="px-2 py-1 rounded border bg-background text-sm">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>entries</span>
          </div>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Cari Nama Gambar..."
            className="px-3 py-2 rounded-lg border bg-background text-sm w-full sm:w-60"
          />
        </div>

        {/* Mobile: card list */}
        <div className="sm:hidden space-y-3">
          {paginated.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Belum ada data</div>
          ) : paginated.map((item, i) => (
            <div key={item.id} className="border rounded-lg p-3 space-y-2.5 bg-background/40">
              <div className="flex items-start gap-3">
                <img src={item.directLink} alt="" className="w-12 h-12 rounded object-cover border flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">#{page * perPage + i + 1}</p>
                  <p className="font-semibold text-sm truncate">{item.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">🕐 {item.createdAt}</p>
                </div>
                <button onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive/80 flex-shrink-0 p-1" aria-label="Hapus">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-[11px] bg-muted px-2 py-1.5 rounded truncate flex-1 min-w-0">{item.directLink}</code>
                <button onClick={() => handleCopy(item.directLink)} className="text-primary hover:text-primary/80 flex-shrink-0 p-1.5 rounded border" aria-label="Salin">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
                <th className="py-3 pr-2 w-12">No</th>
                <th className="py-3 pr-2 w-16">Preview</th>
                <th className="py-3 pr-2">Nama File</th>
                <th className="py-3 pr-2">Direct Link (Copy Ini)</th>
                <th className="py-3 w-16 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada data</td></tr>
              ) : paginated.map((item, i) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3 pr-2 text-muted-foreground">{page * perPage + i + 1}</td>
                  <td className="py-3 pr-2">
                    <img src={item.directLink} alt="" className="w-10 h-10 rounded object-cover border" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                  </td>
                  <td className="py-3 pr-2">
                    <p className="font-medium">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">🕐 {item.createdAt}</p>
                  </td>
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-xs block">{item.directLink}</code>
                      <button onClick={() => handleCopy(item.directLink)} className="text-primary hover:text-primary/80 flex-shrink-0">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-muted-foreground">
          <span className="text-xs sm:text-sm">Menampilkan {paginated.length} dari {filtered.length} data</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="flex-1 sm:flex-none px-3 py-1.5 rounded border bg-background disabled:opacity-50 text-xs sm:text-sm">Sebelumnya</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="flex-1 sm:flex-none px-3 py-1.5 rounded border bg-background disabled:opacity-50 text-xs sm:text-sm">Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
