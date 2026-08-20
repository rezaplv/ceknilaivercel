import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, TextRun, WidthType, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export type Jenis = "FORMATIF" | "SUMATIF" | "STS" | "SAS";

export interface TagihanRow {
  nama: string;
  missing: Record<Jenis, string[]>;
  total: number;
}

export interface TagihanExportData {
  kelas: string;
  mapel: string;
  guru: string;
  semester: string;
  tahunAjaran: string;
  totalSiswa: number;
  rows: TagihanRow[];
}

const JENIS_LIST: Jenis[] = ["FORMATIF", "SUMATIF", "STS", "SAS"];
const fmt = (arr: string[]) => (arr.length === 0 ? "-" : arr.join(", "));
const safeFile = (s: string) => s.replace(/[^a-z0-9-_]+/gi, "_");

function header(d: TagihanExportData) {
  return [
    ["TAGIHAN NILAI SISWA"],
    [`Kelas: ${d.kelas}`, `Mapel: ${d.mapel}`],
    [`Guru: ${d.guru}`, `Semester: ${d.semester} ${d.tahunAjaran}`],
    [`${d.rows.length} dari ${d.totalSiswa} siswa memiliki tagihan`],
    [],
  ];
}

export function exportTagihanToExcel(d: TagihanExportData) {
  const head = header(d);
  const cols = ["No", "Nama Siswa", ...JENIS_LIST, "Total"];
  const body = d.rows.map((r, i) => [
    i + 1,
    r.nama,
    fmt(r.missing.FORMATIF),
    fmt(r.missing.SUMATIF),
    fmt(r.missing.STS),
    fmt(r.missing.SAS),
    r.total,
  ]);
  const aoa = [...head, cols, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tagihan");
  XLSX.writeFile(wb, `Tagihan_${safeFile(d.kelas)}_${safeFile(d.mapel)}.xlsx`);
}

export function exportTagihanToPDF(d: TagihanExportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text("TAGIHAN NILAI SISWA", 148, 14, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text(`Kelas: ${d.kelas}   |   Mapel: ${d.mapel}`, 14, 22);
  doc.text(`Guru: ${d.guru}   |   Semester: ${d.semester} ${d.tahunAjaran}`, 14, 28);
  doc.text(`${d.rows.length} dari ${d.totalSiswa} siswa memiliki tagihan`, 14, 34);

  (doc as any).autoTable({
    startY: 40,
    head: [["No", "Nama Siswa", "FORMATIF", "SUMATIF", "STS", "SAS", "Total"]],
    body: d.rows.map((r, i) => [
      i + 1,
      r.nama,
      fmt(r.missing.FORMATIF),
      fmt(r.missing.SUMATIF),
      fmt(r.missing.STS),
      fmt(r.missing.SAS),
      r.total,
    ]),
    styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [244, 63, 94], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [253, 242, 248] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 50 },
      2: { cellWidth: 60 },
      3: { cellWidth: 60 },
      4: { cellWidth: 35 },
      5: { cellWidth: 35 },
      6: { cellWidth: 15, halign: "center", fontStyle: "bold" },
    },
    margin: { left: 10, right: 10 },
  });

  doc.save(`Tagihan_${safeFile(d.kelas)}_${safeFile(d.mapel)}.pdf`);
}

export async function exportTagihanToWord(d: TagihanExportData) {
  const headerCell = (txt: string, w: number) =>
    new DocxTableCell({
      width: { size: w, type: WidthType.DXA },
      shading: { fill: "F43F5E", type: "clear", color: "auto" } as any,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: txt, bold: true, color: "FFFFFF", size: 18 })] })],
    });
  const cell = (txt: string | number, w: number, bold = false, center = false) =>
    new DocxTableCell({
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(txt), bold, size: 18 })] })],
    });

  const widths = [600, 2400, 3000, 3000, 1800, 1800, 800];
  const totalWidth = widths.reduce((a, b) => a + b, 0);

  const headerRow = new DocxTableRow({
    children: ["No", "Nama Siswa", "FORMATIF", "SUMATIF", "STS", "SAS", "Total"].map((t, i) => headerCell(t, widths[i])),
    tableHeader: true,
  });

  const dataRows = d.rows.map(
    (r, i) =>
      new DocxTableRow({
        children: [
          cell(i + 1, widths[0], false, true),
          cell(r.nama, widths[1]),
          cell(fmt(r.missing.FORMATIF), widths[2]),
          cell(fmt(r.missing.SUMATIF), widths[3]),
          cell(fmt(r.missing.STS), widths[4]),
          cell(fmt(r.missing.SAS), widths[5]),
          cell(r.total, widths[6], true, true),
        ],
      })
  );

  const table = new DocxTable({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: { page: { size: { width: 15840, height: 12240, orientation: "landscape" as any } } },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "TAGIHAN NILAI SISWA", bold: true, size: 28 })] }),
          new Paragraph({ children: [new TextRun({ text: `Kelas: ${d.kelas}   |   Mapel: ${d.mapel}`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `Guru: ${d.guru}   |   Semester: ${d.semester} ${d.tahunAjaran}`, size: 20 })] }),
          new Paragraph({ children: [new TextRun({ text: `${d.rows.length} dari ${d.totalSiswa} siswa memiliki tagihan`, size: 20, italics: true })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Tagihan_${safeFile(d.kelas)}_${safeFile(d.mapel)}.docx`);
}
