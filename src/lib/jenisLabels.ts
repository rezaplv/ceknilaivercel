// Display labels for jenis nilai
// Database values remain: FORMATIF, SUMATIF, STS, SAS
// UI labels are changed per user request

export const JENIS_LABEL: Record<string, string> = {
  FORMATIF: "TUGAS (FORMATIF)",
  SUMATIF: "ULANGAN HARIAN (SUMATIF)",
  STS: "STS",
  SAS: "SAS",
};

// Short prefix for column headers in ALL view
export const JENIS_PREFIX: Record<string, string> = {
  FORMATIF: "T",
  SUMATIF: "UH",
  STS: "STS",
  SAS: "SAS",
};

export const VIEW_OPTIONS_WITH_LABELS = [
  { value: "ALL", label: "ALL" },
  { value: "FORMATIF", label: "TUGAS (FORMATIF)" },
  { value: "SUMATIF", label: "ULANGAN HARIAN (SUMATIF)" },
  { value: "STS", label: "STS" },
  { value: "SAS", label: "SAS" },
];

export function getJenisLabel(jenis: string): string {
  return JENIS_LABEL[jenis] || jenis;
}

export function getJenisPrefix(jenis: string): string {
  return JENIS_PREFIX[jenis] || jenis;
}
