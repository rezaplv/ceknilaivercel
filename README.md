# CEK NILAI

Buat aplikasi web Apps Script + Spreadsheet sebagai database, login username+password, role: ADMIN/GURU/SISWA.
UI: profesional, sidebar biru dengan hover/click hidup, ada hamburger; tampil nama user login. Responsif mobile/desktop.
Login page: background transparan bersih (glassmorphism), login box lebih kontras, dan box mengikuti arah kursor (tilt/translate halus).

Menu ADMIN & GURU: Dashboard, Input Nilai, Rekap Nilai, Manajemen User, Konfigurasi, Broadcast.
Menu SISWA: Dashboard (sapaan nama, kelas, jumlah mapel, papan broadcast), Hasil Belajar.

Fitur Dashboard:
- Admin: tanggal & jam realtime, total guru, total siswa, total kelas, total mapel.
- Guru: tanggal & jam, total siswa terakses, total kelas terakses, total mapel terakses.

Input Nilai (admin & guru): 3 cara: Manual, Batch input, Upload CSV.
Manual: pilih kelas -> mapel -> jenis nilai (FORMATIF/SUMATIF/STS/SAS).
FORMATIF dan SUMATIF bisa memiliki banyak penilaian dengan nama custom. STS dan SAS hanya satu penilaian.
FORMATIF bisa input angka atau ceklis tergantung setting/assessment input_mode.
Nilai disimpan ke Spreadsheet.

Rekap Nilai (admin & guru): pilih kelas -> mapel -> pilih tampilan (ALL atau salah satu jenis).
FORMATIF & SUMATIF tampilkan rata-rata. STS & SAS tanpa rata-rata.
Nilai Akhir: (2*RataFormatif + 2*RataSumatif + STS + SAS)/6.
Sediakan export PDF & Excel.

Manajemen User:
- Admin bisa buat akun guru & siswa. Guru hanya bisa buat akun siswa.
- Mode: Satuan, Batch, Upload Template.
Field: username, password, role, nama lengkap, kelas, mapel. Guru bisa multi kelas & mapel. Siswa kelas single, mapel bisa multi.
Daftar user dibedakan ADMIN/GURU/SISWA, urut alfabet, ada nomor. Aksi: edit popup (icon pensil), hapus single, hapus massal per role.

Konfigurasi: ubah nama aplikasi, sub-deskripsi, logo, background login & app via URL drive.
Broadcast: admin/guru membuat pengumuman tampil di dashboard siswa.

Database Spreadsheet (sheet schema):
SETTINGS(key,value)
KELAS(kelas_id,nama_kelas,aktif)
MAPEL(mapel_id,nama_mapel,aktif)
USERS(user_id,username,pass_hash,pass_salt,role,nama_lengkap,aktif,created_at)
USER_KELAS(user_id,kelas_id)
USER_MAPEL(user_id,mapel_id)
ASSESSMENTS(assess_id,kelas_id,mapel_id,jenis,nama_penilaian,input_mode,created_by,created_at,aktif)
SCORES(score_id,assess_id,siswa_user_id,value_num,value_bool,updated_by,updated_at)
BROADCASTS(bc_id,title,message,target_scope,target_kelas_id,target_mapel_id,created_by,created_at,aktif)
(optional) AUDIT_LOG(log_id,actor_user_id,action,entity,entity_id,payload_json,created_at)

Buat rancangan backend functions (auth, users, input nilai, rekap, export) + frontend HTML/CSS/JS dengan google.script.run, termasuk validasi role dan permission:
Admin akses semua, Guru terbatas kelas/mapel assignment, Siswa read-only data miliknya.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ceknilai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/56872f15-a2c8-4151-a069-648ba5f42ff1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
