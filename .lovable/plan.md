

## Plan: Fitur Edit Nama Penilaian Formatif di Rekap Nilai

### Apa yang akan dibuat
Menambahkan kemampuan bagi Admin dan Guru untuk mengubah/rename nama penilaian Formatif langsung dari halaman Rekap Nilai. Saat klik nama kolom Formatif di header tabel, muncul input field untuk mengedit nama tersebut. Perubahan akan mengupdate semua record `scores` yang memiliki `nama_penilaian` lama menjadi nama baru.

### Perubahan Teknis

**1. `src/lib/api.ts`** -- Tambah fungsi baru:
```typescript
async function renameNamaPenilaian(
  kelasId: string, mapelId: string, jenis: string, 
  oldName: string, newName: string
)
```
Fungsi ini akan menjalankan `UPDATE scores SET nama_penilaian = newName WHERE kelas_id = ... AND mapel_id = ... AND jenis = ... AND nama_penilaian = oldName`.

**2. `src/pages/RekapNilai.tsx`** -- Perubahan UI:
- Tambah state `editingHeader` untuk tracking header mana yang sedang diedit
- Pada header kolom Formatif, tambahkan icon `Pencil` dan handler klik
- Saat diklik, header berubah menjadi input field + tombol Save/Cancel
- Setelah save, panggil `renameNamaPenilaian()` lalu reload data
- Juga update tombol hapus dan kolom Nilai Asli agar konsisten

**3. `src/pages/NilaiAsli.tsx`** -- Perubahan serupa agar nama yang diubah juga tercermin di halaman Nilai Asli (read-only, tidak perlu edit di sini karena data sama).

### Alur pengguna
1. Buka Rekap Nilai, pilih kelas & mapel
2. Klik nama Formatif di header tabel (misal "F: TUGAS UNSUR INTRINSIK RESENSI")
3. Muncul input text dengan nama saat ini
4. Ubah nama → klik Save atau tekan Enter
5. Semua record scores dengan nama lama diupdate ke nama baru
6. Tabel dan tombol hapus ter-refresh otomatis

