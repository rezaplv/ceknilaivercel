import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, TextRun, WidthType, AlignmentType, BorderStyle, PageOrientation } from "docx";
import { saveAs } from "file-saver";

export type RekapView = "ALL" | "FORMATIF" | "SUMATIF" | "STS" | "SAS";

export interface ExportData {
  kelas: string;
  mapel: string;
  guru: string;
  semester: string;
  tahunAjaran: string;
  students: { id: string; nama: string }[];
  allScores: any[];
  formatifNames: string[];
  sumatifNames: string[];
  view?: RekapView;
}

function buildRows(data: ExportData) {
  const { students, allScores, formatifNames, sumatifNames, view = "ALL" } = data;

  const showF = view === "ALL" || view === "FORMATIF";
  const showS = view === "ALL" || view === "SUMATIF";
  const showSTS = view === "ALL" || view === "STS";
  const showSAS = view === "ALL" || view === "SAS";
  const showNA = view === "ALL";

  const getScore = (studentId: string, jenis: string, nama?: string) =>
    allScores.find((s: any) => s.student_id === studentId && s.jenis === jenis && (nama ? s.nama_penilaian === nama : true));

  const getScoresFor = (studentId: string, jenis: string) =>
    allScores.filter((s: any) => s.student_id === studentId && s.jenis === jenis && s.nilai_type === "angka");

  const avg = (nums: number[]) => nums.length > 0 ? nums.map(n => n < 0 ? 0 : n).reduce((a, b) => a + b, 0) / nums.length : null;

  const calcNA = (avgF: number | null, avgS: number | null, sts: number | null, sas: number | null) => {
    const f = avgF ?? 0;
    const s = avgS ?? 0;
    const st = (sts !== null && sts >= 0) ? sts : 0;
    const sa = (sas !== null && sas >= 0) ? sas : 0;
    return (2 * f + 2 * s + st + sa) / 6;
  };

  return students.map((st, i) => {
    const fScores = getScoresFor(st.id, "FORMATIF");
    const sScores = getScoresFor(st.id, "SUMATIF");
    const avgF = avg(fScores.map((s: any) => Number(s.nilai)));
    const avgS = avg(sScores.map((s: any) => Number(s.nilai)));
    const stsEntry = getScore(st.id, "STS");
    const sasEntry = getScore(st.id, "SAS");
    const sts = stsEntry ? Number(stsEntry.nilai) : null;
    const sas = sasEntry ? Number(sasEntry.nilai) : null;
    const na = calcNA(avgF, avgS, sts, sas);

    const row: (string | number)[] = [i + 1, st.nama];

    if (showF) {
      formatifNames.forEach(name => {
        const entry = getScore(st.id, "FORMATIF", name);
        const val = entry ? Number(entry.nilai) : null;
        row.push(val !== null ? (val < 0 ? "-" : val) : "");
      });
      if (formatifNames.length >= 1) {
        row.push(avgF !== null ? Math.round(avgF * 10) / 10 : "");
      }
    }

    if (showS) {
      sumatifNames.forEach(name => {
        const entry = getScore(st.id, "SUMATIF", name);
        const val = entry ? Number(entry.nilai) : null;
        row.push(val !== null ? (val < 0 ? "-" : val) : "");
      });
      if (sumatifNames.length >= 1) {
        row.push(avgS !== null ? Math.round(avgS * 10) / 10 : "");
      }
    }

    if (showSTS) row.push(sts !== null ? (sts < 0 ? "-" : sts) : "");
    if (showSAS) row.push(sas !== null ? (sas < 0 ? "-" : sas) : "");
    if (showNA) row.push(na !== null ? Math.round(na * 10) / 10 : "");

    return row;
  });
}

function getViewTitle(view: RekapView): string {
  const labels: Record<string, string> = { ALL: "DAFTAR NILAI", FORMATIF: "DAFTAR NILAI - TUGAS (FORMATIF)", SUMATIF: "DAFTAR NILAI - ULANGAN HARIAN (SUMATIF)", STS: "DAFTAR NILAI - STS", SAS: "DAFTAR NILAI - SAS" };
  return labels[view] || "DAFTAR NILAI";
}

// ============ EXCEL ============
export function exportToExcel(data: ExportData) {
  const { kelas, mapel, guru, semester, tahunAjaran, formatifNames, sumatifNames, view = "ALL" } = data;
  const rows = buildRows(data);

  const showF = view === "ALL" || view === "FORMATIF";
  const showS = view === "ALL" || view === "SUMATIF";
  const showSTS = view === "ALL" || view === "STS";
  const showSAS = view === "ALL" || view === "SAS";
  const showNA = view === "ALL";

  let totalCols = 2;
  if (showF) totalCols += formatifNames.length + (formatifNames.length > 1 ? 1 : 0);
  if (showS) totalCols += sumatifNames.length + (sumatifNames.length >= 1 ? 1 : 0);
  if (showSTS) totalCols += 1;
  if (showSAS) totalCols += 1;
  if (showNA) totalCols += 1;

  const wsData: any[][] = [];
  wsData.push([getViewTitle(view as RekapView)]);
  wsData.push([]);
  wsData.push(["KELAS", "", `: ${kelas}`, "", "", "", "", "", "", "SEMESTER", "", `: ${semester}`]);
  wsData.push(["MATA PELAJARAN", "", `: ${mapel}`, "", "", "", "", "", "", "TAHUN PELAJARAN", "", `: ${tahunAjaran}`]);
  wsData.push(["GURU", "", `: ${guru}`]);
  wsData.push([]);

  const h1: any[] = ["NO", "NAMA"];
  if (showF) {
     for (let i = 0; i < formatifNames.length; i++) h1.push(i === 0 ? "TUGAS (FORMATIF)" : "");
    if (formatifNames.length > 1) h1.push("RERATA");
  }
  if (showS) {
    for (let i = 0; i < sumatifNames.length; i++) h1.push(i === 0 ? "UL. HARIAN (SUMATIF)" : "");
    if (sumatifNames.length >= 1) h1.push("RERATA");
  }
  if (showSTS) h1.push("STS");
  if (showSAS) h1.push("SAS");
  if (showNA) h1.push("NA");
  wsData.push(h1);

  const h2: any[] = ["", ""];
  if (showF) {
    formatifNames.forEach(n => h2.push(n));
    if (formatifNames.length > 1) h2.push("TUGAS");
  }
  if (showS) {
    sumatifNames.forEach(n => h2.push(n));
    if (sumatifNames.length >= 1) h2.push("UL. HARIAN");
  }
  if (showSTS) h2.push("");
  if (showSAS) h2.push("");
  if (showNA) h2.push("");
  wsData.push(h2);

  rows.forEach(r => wsData.push(r));

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(totalCols - 1, 0) } }];

  if (showF && formatifNames.length > 1) {
    ws["!merges"].push({ s: { r: 6, c: 2 }, e: { r: 6, c: 2 + formatifNames.length - 1 } });
  }
  if (showS && sumatifNames.length > 1) {
    let sStart = 2;
    if (showF) sStart += formatifNames.length + (formatifNames.length > 1 ? 1 : 0);
    ws["!merges"].push({ s: { r: 6, c: sStart }, e: { r: 6, c: sStart + sumatifNames.length - 1 } });
  }

  const colWidths: { wch: number }[] = [{ wch: 5 }, { wch: 35 }];
  for (let i = 2; i < totalCols; i++) colWidths.push({ wch: 14 });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");
  XLSX.writeFile(wb, `Rekap_Nilai_${view}_${kelas}_${mapel}.xlsx`);
}

// ============ PDF ============
export function exportToPDF(data: ExportData) {
  const { kelas, mapel, guru, semester, tahunAjaran, formatifNames, sumatifNames, view = "ALL" } = data;
  const rows = buildRows(data);

  const showF = view === "ALL" || view === "FORMATIF";
  const showS = view === "ALL" || view === "SUMATIF";
  const showSTS = view === "ALL" || view === "STS";
  const showSAS = view === "ALL" || view === "SAS";
  const showNA = view === "ALL";

  let totalCols = 2;
  if (showF) totalCols += formatifNames.length + (formatifNames.length > 1 ? 1 : 0);
  if (showS) totalCols += sumatifNames.length + (sumatifNames.length >= 1 ? 1 : 0);
  if (showSTS) totalCols += 1;
  if (showSAS) totalCols += 1;
  if (showNA) totalCols += 1;

  const doc = new jsPDF({ orientation: totalCols > 8 ? "landscape" : "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(getViewTitle(view as RekapView), doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });

  doc.setFontSize(10);
  const leftX = 14;
  const rightX = doc.internal.pageSize.getWidth() - 80;
  doc.text(`KELAS : ${kelas}`, leftX, 25);
  doc.text(`MATA PELAJARAN : ${mapel}`, leftX, 31);
  doc.text(`GURU : ${guru}`, leftX, 37);
  doc.text(`SEMESTER : ${semester}`, rightX, 25);
  doc.text(`TAHUN PELAJARAN : ${tahunAjaran}`, rightX, 31);

  // Determine if we need 2 header rows
  const needsSubHeaders = (showF && formatifNames.length > 0) || (showS && sumatifNames.length > 0);
  const head2: any[] = [];

  if (needsSubHeaders) {
    if (showF && formatifNames.length > 0) formatifNames.forEach(n => head2.push(n));
    if (showS && sumatifNames.length > 0) sumatifNames.forEach(n => head2.push(n));
  }

  const useDoubleHeader = head2.length > 0;

  const head1: any[] = [
    useDoubleHeader ? { content: "NO", rowSpan: 2 } : "NO",
    useDoubleHeader ? { content: "NAMA", rowSpan: 2 } : "NAMA",
  ];

  if (showF) {
    if (formatifNames.length > 0) head1.push({ content: "TUGAS (FORMATIF)", colSpan: formatifNames.length });
    if (formatifNames.length > 1) head1.push(useDoubleHeader ? { content: "RERATA\nTUGAS", rowSpan: 2 } : "RERATA\nTUGAS");
  }
  if (showS) {
    if (sumatifNames.length > 0) head1.push({ content: "UL. HARIAN (SUMATIF)", colSpan: sumatifNames.length });
    if (sumatifNames.length >= 1) head1.push(useDoubleHeader ? { content: "RERATA\nUL. HARIAN", rowSpan: 2 } : "RERATA\nUL. HARIAN");
  }
  if (showSTS) head1.push(useDoubleHeader ? { content: "STS", rowSpan: 2 } : "STS");
  if (showSAS) head1.push(useDoubleHeader ? { content: "SAS", rowSpan: 2 } : "SAS");
  if (showNA) head1.push(useDoubleHeader ? { content: "NA", rowSpan: 2 } : "NA");

  const headRows = useDoubleHeader ? [head1, head2] : [head1];

  (doc as any).autoTable({
    startY: 42,
    head: headRows,
    body: rows.map(r => r.map(v => (v === "" ? "-" : v))),
    styles: { fontSize: 7, cellPadding: 1.5, halign: "center", lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontStyle: "bold" },
    bodyStyles: { lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40, halign: "left" } },
    theme: "grid",
  });

  doc.save(`Rekap_Nilai_${view}_${kelas}_${mapel}.pdf`);
}

// ============ WORD ============
export async function exportToWord(data: ExportData) {
  const { kelas, mapel, guru, semester, tahunAjaran, formatifNames, sumatifNames, view = "ALL" } = data;
  const rows = buildRows(data);

  const showF = view === "ALL" || view === "FORMATIF";
  const showS = view === "ALL" || view === "SUMATIF";
  const showSTS = view === "ALL" || view === "STS";
  const showSAS = view === "ALL" || view === "SAS";
  const showNA = view === "ALL";

  let totalDataCols = 2;
  if (showF) totalDataCols += formatifNames.length + (formatifNames.length > 1 ? 1 : 0);
  if (showS) totalDataCols += sumatifNames.length + (sumatifNames.length >= 1 ? 1 : 0);
  if (showSTS) totalDataCols += 1;
  if (showSAS) totalDataCols += 1;
  if (showNA) totalDataCols += 1;

  const useLandscape = totalDataCols > 8;

  const borderStyle = {
    top: { style: BorderStyle.SINGLE, size: 1 },
    bottom: { style: BorderStyle.SINGLE, size: 1 },
    left: { style: BorderStyle.SINGLE, size: 1 },
    right: { style: BorderStyle.SINGLE, size: 1 },
  };

  const makeCell = (text: string, bold = false) =>
    new DocxTableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })],
      borders: borderStyle,
    });

  const makeLeftCell = (text: string, bold = false) =>
    new DocxTableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold, size: 16, font: "Arial" })], alignment: AlignmentType.LEFT })],
      borders: borderStyle,
    });

  const headerCells1: DocxTableCell[] = [
    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NO", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2, width: { size: 500, type: WidthType.DXA } }),
    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NAMA", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2, width: { size: 3000, type: WidthType.DXA } }),
  ];

  const headerCells2: DocxTableCell[] = [];

  if (showF) {
    if (formatifNames.length > 0) {
      headerCells1.push(new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "TUGAS (FORMATIF)", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })],
        borders: borderStyle,
        columnSpan: formatifNames.length,
      }));
      formatifNames.forEach(n => headerCells2.push(makeCell(n, true)));
    }
    if (formatifNames.length > 1) {
      headerCells1.push(new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "RERATA T", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2 }));
    }
  }

  if (showS) {
    if (sumatifNames.length > 0) {
      headerCells1.push(new DocxTableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "UL. HARIAN (SUMATIF)", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })],
        borders: borderStyle,
        columnSpan: sumatifNames.length,
      }));
      sumatifNames.forEach(n => headerCells2.push(makeCell(n, true)));
    }
    if (sumatifNames.length >= 1) {
      headerCells1.push(new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "RERATA UH", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2 }));
    }
  }

  if (showSTS) headerCells1.push(new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "STS", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2 }));
  if (showSAS) headerCells1.push(new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SAS", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2 }));
  if (showNA) headerCells1.push(new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: "NA", bold: true, size: 16, font: "Arial" })], alignment: AlignmentType.CENTER })], borders: borderStyle, rowSpan: 2 }));

  const dataRows = rows.map(r =>
    new DocxTableRow({
      children: r.map((v, ci) =>
        ci === 1 ? makeLeftCell(String(v === "" ? "-" : v)) : makeCell(String(v === "" ? "-" : v))
      ),
    })
  );

  const tableRows = [
    new DocxTableRow({ children: headerCells1 }),
    ...(headerCells2.length > 0 ? [new DocxTableRow({ children: headerCells2 })] : []),
    ...dataRows,
  ];

  const table = new DocxTable({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: useLandscape ? {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      } : {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({ children: [new TextRun({ text: getViewTitle(view as RekapView), bold: true, size: 28, font: "Arial" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { after: 100 } }),
        new Paragraph({ children: [new TextRun({ text: `KELAS\t\t\t: ${kelas}`, size: 20, font: "Arial" }), new TextRun({ text: `\t\t\tSEMESTER\t\t: ${semester}`, size: 20, font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: `MATA PELAJARAN\t\t: ${mapel}`, size: 20, font: "Arial" }), new TextRun({ text: `\t\t\tTAHUN PELAJARAN\t: ${tahunAjaran}`, size: 20, font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: `GURU\t\t\t: ${guru}`, size: 20, font: "Arial" })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: "", size: 20 })], spacing: { after: 100 } }),
        table,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Rekap_Nilai_${view}_${kelas}_${mapel}.docx`);
}
