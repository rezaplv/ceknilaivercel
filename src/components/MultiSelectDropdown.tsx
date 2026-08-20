import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  options: { id: string; nama: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelectDropdown({ options, selected, onChange, placeholder = "Pilih...", className }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (nama: string) => {
    onChange(selected.includes(nama) ? selected.filter(s => s !== nama) : [...selected, nama]);
  };

  const remove = (nama: string) => {
    onChange(selected.filter(s => s !== nama));
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        onClick={() => setOpen(!open)}
        className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-input bg-background text-sm cursor-pointer flex items-center justify-between gap-2 focus-within:ring-2 focus-within:ring-ring"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
              {s}
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(s); }} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-md max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada data. Daftarkan di menu Konfigurasi.</div>
          ) : (
            options.map(opt => (
              <div
                key={opt.id}
                onClick={() => toggle(opt.nama)}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors",
                  selected.includes(opt.nama) && "bg-primary/5 font-medium text-primary"
                )}
              >
                {opt.nama}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
