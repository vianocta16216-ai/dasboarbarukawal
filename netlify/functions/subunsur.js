// ====== DATA SUBUNSUR (LENGKAP - DARI FILE KONFIGURASI ANDA) ======
const SUBUNSUR_DATA = {
  '1.1': {
    label: '1.1 Penegakan Integritas dan Nilai Etika',
    params: [
      {
        id: '1.1.1',
        desc: 'K/L/D menegakkan integritas dan nilai etika dalam melaksanakan tugas dan fungsi organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan penegakan integritas dan nilai etika untuk seluruh pegawai dalam organisasi.', evidence: '1. Kode Etik/Kode Perilaku 2. Pakta Integritas 3. Surat Edaran/Instruksi Kepala OPD tentang integritas', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan penegakan integritas dan nilai etika organisasi telah dipahami oleh seluruh pegawai.', evidence: '1. Daftar hadir sosialisasi 2. Materi sosialisasi 3. Notulen/berita acara sosialisasi', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Penegakan integritas dan nilai etika telah dilaksanakan oleh pegawai dalam pelaksanaan tugas dan fungsinya dalam organisasi.', evidence: '1. Pakta Integritas pimpinan 2. Notulen/arahan pimpinan tentang integritas 3. Bukti pembinaan/penegakan disiplin, jika ada', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi organisasi telah dievaluasi untuk meningkatkan integritas dan nilai etika para pegawai.', evidence: '1. Laporan hasil evaluasi/monitoring 2. Dokumen tindak lanjut hasil evaluasi 3. Bukti perbaikan kebijakan/SOP', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Penegakan integritas dan nilai etika telah diperbaiki secara berkelanjutan sehingga tercipta suasana kerja organisasi yang kondusif yang dapat mendorong kinerja para pegawai secara optimal.', evidence: '1. Rekap monitoring/penerapan integritas selama 1 tahun 2. Rekap pelanggaran dan tindak lanjut 3. Bukti perbaikan berkelanjutan 4. Bukti penerapan reward/punishment secara konsisten', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.2': {
    label: '1.2 Komitmen terhadap Kompetensi',
    params: [
      {
        id: '1.2.1',
        desc: 'Tugas dan jabatan dalam organisasi dilaksanakan dan diisi oleh SDM yang kompeten',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat standar kompetensi yang jelas untuk seluruh jabatan dan posisi dalam organisasi.', evidence: 'Standar Kompetensi Jabatan; Peta Jabatan; Anjab dan ABK.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Standar kompetensi telah dikomunikasikan dan dipahami oleh seluruh pegawai organisasi.', evidence: 'Standar Kompetensi Jabatan; Bukti sosialisasi/penyampaian standar kompetensi; Daftar hadir/notulen.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Standar kompetensi telah diimplementasikan/dimanfaatkan dalam pengelolaan/pembinaan SDM organisasi.', evidence: 'Matriks Pemetaan Kompetensi Pegawai; Analisis Kesenjangan Kompetensi; Rencana Pengembangan Kompetensi ASN.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Standar kompetensi organisasi dan implementasi/pemanfaatannya telah dievaluasi untuk mengetahui efektivitasnya.', evidence: 'Laporan Evaluasi Penerapan Standar Kompetensi Jabatan; Laporan Hasil Monitoring Kesesuaian Kompetensi Pegawai dengan Jabatan; Matriks Tindak Lanjut Hasil Evaluasi.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pengelolaan kompetensi SDM telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Laporan Evaluasi/Pemetaan Kompetensi Pegawai Tahun Berjalan; Laporan Tindak Lanjut Pengembangan Kompetensi ASN; Dokumen Pemutakhiran Standar Kompetensi Jabatan.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.3': {
    label: '1.3 Kepemimpinan yang Kondusif',
    params: [
      { id: '1.3.1', desc: 'Pimpinan K/L/D menciptakan lingkungan kerja yang kondusif untuk mendukung ketaatan terhadap peraturan yang berlaku', levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi terlibat dalam penyusunan dan penetapan kebijakan yang mendukung penciptaan lingkungan kerja yang kondusif untuk pencapaian tujuan organisasi.', evidence: 'SK/Surat Edaran/Kebijakan Internal yang Ditetapkan Pimpinan (Dokumen kebijakan manajemen kinerja, keuangan, SDM, atau manajemen risiko)', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Pimpinan organisasi terlibat dalam penyusunan dan penetapan kebijakan ... serta memahami substansi kebijakan pengendalian intern dan mendorong penerapan kebijakan.', evidence: 'Notulen, Daftar hadir; dokumentasi rapat; bahan paparan/surat arahan pimpinan', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pimpinan organisasi melaksanakan kebijakan dan didukung dengan SDM yang bekerja sesuai dengan kebijakan yang ditetapkan.', evidence: 'Perjanjian Kinerja Inspektur/Kepala OPD/Pakta Integritas; SK Tim Manajemen Risiko; Dokumen pelaksanaan manajemen risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Pimpinan organisasi melaksanakan evaluasi berkala atas kebijakan pengendalian intern dan berupaya mengatasi permasalahan yang berkaitan dengan lingkungan pengendalian yang kondusif.', evidence: 'Laporan Monitoring SPIP; Matriks Tindak Lanjut; Bukti penyelesaian tindak lanjut', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Penerapan manajemen kinerja, pengelolaan keuangan, manajemen SDM, serta manajemen risiko dapat meningkatkan efektivitas dan efisiensi kinerja seluruh level pimpinan dan pegawai.', evidence: 'Laporan Evaluasi Kinerja Inspektorat/OPD Tahun Berjalan (LKjIP)', note: 'A – Perbaikan Berkelanjutan' }
      ] },
      { id: '1.3.2', desc: 'Pimpinan K/L/D mengalokasikan sumber daya untuk penerapan manajemen risiko', levels: [
          { grade: 'E', level: 1, desc: 'Sudah mengalokasikan sumber daya untuk penerapan manajemen risiko pada tingkat operasional unit kerja namun belum memadai', evidence: 'DPA/DPPA + SK UPR', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja namun pada tingkat strategis unit kerja belum memadai', evidence: 'DPA/DPPA/RKA + SK UPR + bukti kegiatan MR', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja dan strategis unit kerja', evidence: 'DPA/DPPA/RKA + SK UPR + Profil Risiko/RTP', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja dan strategis unit kerja namun pada tingkat strategis K/L/D belum memadai', evidence: 'DPA/DPPA/RKA + SK UPR + Profil Risiko/RTP + bukti monitoring/reviu', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Sudah mengalokasikan sumber daya secara memadai untuk penerapan manajemen risiko pada tingkat operasional unit kerja, strategis unit kerja, dan strategis K/L/D', evidence: 'DPA/DPPA/RKA + SK UPR + Daftar SDM UPR & Bukti Kompetensi ≥70% + Profil Risiko/RTP + laporan monitoring/reviu', note: 'A – Perbaikan Berkelanjutan' }
      ] },
      { id: '1.3.3', desc: 'Pimpinan K/L/D menggunakan informasi terkait risiko dalam pengambilan keputusan', levels: [
          { grade: 'E', level: 1, desc: 'Sebagian pengambilan keputusan operasional unit kerja telah mempertimbangkan risiko', evidence: 'Profil risiko OPD', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Seluruh pengambilan keputusan operasional unit kerja telah mempertimbangkan risiko', evidence: 'Renja OPD', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Seluruh pengambilan keputusan strategis unit kerja dan operasional unit kerja telah mempertimbangkan risiko', evidence: 'Renja OPD berbasis risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Seluruh pengambilan keputusan strategis K/L/D, strategis unit kerja, dan operasional unit kerja telah mempertimbangkan risiko', evidence: 'Renja OPD berbasis risiko', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Seluruh pengambilan keputusan strategis K/L/D, strategis unit kerja, dan operasional unit kerja telah mempertimbangkan risiko dan memberikan dampak bagi pencapaian tujuan organisasi', evidence: 'Dokumen penetapan prioritas kegiatan yang menggunakan hasil penilaian risiko (SK Penetapan Rencana Aksi (Renaksi))', note: 'A – Perbaikan Berkelanjutan' }
      ] },
      { id: '1.3.4', desc: 'Pimpinan K/L/D mendorong penerapan manajemen risiko, melalui penggunaan kinerja penerapan manajemen risiko sebagai indikator penilaian kinerja', levels: [
          { grade: 'E', level: 1, desc: 'Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada sebagian UPR tingkatan operasional unit kerja secara memadai', evidence: 'Renja OPD', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh UPR tingkatan operasional unit kerja secara memadai', evidence: 'Renja OPD', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh UPR tingkatan operasional unit kerja dan seluruh UPR tingkatan strategis unit kerja secara memadai', evidence: 'Perjanjian Kinerja OPD', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh UPR tingkatan operasional unit kerja, seluruh UPR tingkatan strategis unit kerja, dan UPR tingkat strategis K/L/D secara memadai', evidence: 'Perjanjian Kinerja OPD, SKP', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Kinerja penerapan manajemen risiko digunakan sebagai dasar penilaian kinerja pada seluruh UPR tingkatan operasional unit kerja, seluruh UPR tingkatan strategis unit kerja, dan UPR tingkat strategis K/L/D secara memadai dan telah dievaluasi pencapaiannya', evidence: 'LKjIP OPD', note: 'A – Perbaikan Berkelanjutan' }
      ] }
    ]
  },
  '1.4': {
    label: '1.4 Struktur Organisasi Sesuai Kebutuhan',
    params: [
      {
        id: '1.4.1',
        desc: 'Struktur organisasi dibentuk dalam rangka mendukung pencapaian sasaran strategis organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat penetapan struktur, tugas, dan fungsi organisasi.', evidence: 'Perda/Perkada Pembentukan dan Susunan Perangkat Daerah; Perkada SOTK OPD; Bagan Struktur Organisasi OPD', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Proses bisnis organisasi dapat didukung dengan struktur organisasi yang ditetapkan dan personel pada setiap lini mengetahui arus data dan informasi yang diperlukan dalam melaksanaan tugas dan fungsinya.', evidence: 'Dokumen Proses Bisnis OPD; SOP OPD; Bukti Sosialisasi Struktur Organisasi dan Tata Kerja', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Struktur organisasi dijalankan sesuai proses bisnis organisasi dengan SDM yang mencukupi.', evidence: 'Dokumen Proses Bisnis OPD; Kumpulan SOP OPD; Peta Jabatan; Analisis Jabatan (Anjab); Analisis Beban Kerja (ABK)', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Efisiensi dan efektivitas struktur organisasi dapat dilihat secara berkala melalui pengujian atas pelaksanaan proses bisnis organisasi dan ketepatannya dengan perencanaan strategis.', evidence: 'Laporan Evaluasi Kelembagaan/Organisasi; Laporan Evaluasi Proses Bisnis/SOP; Matriks Tindak Lanjut Hasil Evaluasi; Dokumen Perbaikan SOP/Proses Bisnis', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'K/L/D memiliki fleksibilitas untuk menyesuaikan struktur organisasi dalam rangka mendukung perubahan proses bisnis dan perubahan perencanaan strategis.', evidence: 'Laporan Evaluasi Kelembagaan yang menjadi dasar perbaikan; Dokumen Pemutakhiran Proses Bisnis; Dokumen Pemutakhiran SOP; Dokumen perubahan/pemutakhiran SOTK; Bukti penggunaan sistem/aplikasi yang mendukung proses bisnis dan arus informasi', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.5': {
    label: '1.5 Pendelegasian Wewenang dan Tanggung Jawab yang Tepat',
    params: [
      {
        id: '1.5.1',
        desc: 'Wewenang dan tanggung jawab diberikan kepada pegawai yang tepat sesuai tingkatannya untuk mendukung efektivitas dan efisiensi pelaksanaan kegiatan dalam rangka percepatan pencapaian tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi menetapkan kebijakan terkait wewenang dan tanggung jawab pelaksanaan kegiatan kepada struktur di bawahnya secara berjenjang.', evidence: '1. Peraturan Bupati tentang SOTK OPD 2. SK/Surat Keputusan tentang Pendelegasian Wewenang 3. SOP Pelaksanaan Pendelegasian Wewenang dan Tanggung Jawab', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kegiatan/prosedur yang dalam pelaksanaannya telah didelegasikan kepada struktur dibawahnya telah dipahami dan diketahui oleh pihak terkait.', evidence: 'SK/Keputusan Pendelegasian Wewenang; SOP Pendelegasian Wewenang; Notulen/Daftar Hadir Sosialisasi Pendelegasian Wewenang', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pelaksanaan tugas dan fungsi yang didelegasikan dilaksanakan sesuai dengan kebijakan/prosedur yang ditetapkan.', evidence: 'SK/Surat Penetapan Penerima Delegasi Wewenang; Dokumen pelaksanaan tugas oleh pejabat penerima delegasi; Laporan pertanggungjawaban/pelaporan pelaksanaan kewenangan', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Efisiensi dan efektivitas pelaksanaan wewenang dan tanggung jawab organisasi yang didelegasikan dapat dilihat melalui evaluasi berkala atas pelaksanaan wewenang dan tanggungjawab serta analisis terhadap kualitas hasil pelaksanaan tugas/fungsi yang dilaksanakan (respon stakeholder).', evidence: 'Laporan Evaluasi Pelaksanaan Pendelegasian Wewenang; Laporan Hasil Monitoring Pendelegasian Wewenang; Matriks Tindak Lanjut Hasil Evaluasi', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pimpinan organisasi memiliki akses untuk melihat proses pendelegasian wewenang dan tanggungjawab yang diberikan dan memonitor pelaksanaan tugas fungsi yang dijalankan untuk menjamin tujuan percepatan yang diharapkan dan mendukung perbaikan secara berkelanjutan.', evidence: 'Laporan/rekapitulasi monitoring pelaksanaan pendelegasian wewenang; Bukti penggunaan aplikasi/sistem monitoring dan pelaporan, jika tersedia; Dokumen arahan/teguran pimpinan atas hasil monitoring; Dokumen tindak lanjut masukan/keluhan stakeholder; Bukti perbaikan SOP atau mekanisme pendelegasian', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.6': {
    label: '1.6 Penyusunan dan Penerapan Kebijakan yang Sehat tentang Pembinaan SDM',
    params: [
      {
        id: '1.6.1',
        desc: 'Penerapan kebijakan manajemen dan praktik pembinaan SDM sehingga dapat digunakan secara maksimal untuk mencapai tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur pengelolaan SDM sejak rekrutmen sampai dengan pemberhentian pegawai.', evidence: '1. Peraturan Bupati terkait Manajemen Talenta ASN 2. SOP Pengadaan/Penerimaan Pegawai 3. SOP Penilaian Kinerja Pegawai 4. SOP Kenaikan Pangkat/Jabatan 5. SOP Pengembangan Kompetensi 6. SOP Mutasi 7. SOP Pemberhentian Pegawai 8. SOP Pensiun 9. SOP Supervisi/Pembinaan Pegawai', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pengelolaan SDM telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan dalam organisasi.', evidence: '1. Surat/Nota Dinas Penyampaian Kebijakan/SOP Kepegawaian 2. Undangan Sosialisasi Kebijakan Pengelolaan SDM 3. Materi Sosialisasi 4. Daftar Hadir Sosialisasi 5. Notulen/Berita Acara Sosialisasi', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pengelolaan SDM telah dilaksanakan sejak rekrutmen sampai dengan pemberhentian pegawai sesuai kebijakan/prosedur yang ditetapkan.', evidence: '1. Dokumen Perencanaan Kebutuhan Pegawai 2. Data/Database Kepegawaian 3. SK Pengangkatan/Penempatan Pegawai 4. Dokumen Penilaian Kinerja/SKP 5. Dokumen Pengembangan Kompetensi Pegawai 6. SK Mutasi/Pengangkatan dalam Jabatan, jika ada 7. Dokumen Pemberhentian/Pensiun, jika ada', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait pengelolaan SDM organisasi telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: '1. Laporan Evaluasi Pengelolaan SDM 2. Laporan Monitoring Pengelolaan Kepegawaian 3. Hasil Evaluasi/Penilaian Kinerja Pegawai 4. Matriks Tindak Lanjut Hasil Evaluasi Pengelolaan SDM 5. Dokumen Perbaikan Kebijakan/SOP Kepegawaian', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pengelolaan SDM telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: '1. Laporan Evaluasi Pengelolaan SDM 2. Dokumen Tindak Lanjut/Pengembangan SDM 3. Laporan Hasil Pengembangan Kompetensi Pegawai 4. SKP/Laporan Kinerja Pegawai 5. Laporan Kinerja OPD 6. Dokumen pemutakhiran/perbaikan kebijakan atau SOP pengelolaan SDM', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '1.6.2',
        desc: 'Pegawai telah mendapatkan fasilitas untuk meningkatkan kompetensi dan keterampilan terkait manajemen risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko namun belum memadai', evidence: '1. Dokumen Program/Rencana Pelatihan Manajemen Risiko 2. Surat Keputusan/Surat Tugas Pelatihan Manajemen Risiko, jika ada 3. Daftar kebutuhan pelatihan/sertifikasi manajemen risiko', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan sebagian pegawai', evidence: '1. Rencana/Program Pelatihan Manajemen Risiko 2. Undangan/Surat Pemberitahuan Pelatihan/In-House Training Manajemen Risiko 3. Daftar Peserta Pelatihan/In-House Training 4. Materi Pelatihan Manajemen Risiko', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risikoyang memadai dengan cakupan sebagian besar pegawai', evidence: '1. Laporan Pelaksanaan Pelatihan Manajemen Risiko 2. Daftar Peserta/Daftar Hadir Pelatihan 3. Sertifikat Pelatihan/Sertifikat Kompetensi Manajemen Risiko 4. Rekapitulasi Pegawai yang Telah Mengikuti Pelatihan/Sertifikasi Manajemen Risiko 5. Laporan Pelaksanaan In-House Training Manajemen Risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan seluruh pegawai', evidence: '1. Laporan Evaluasi Pelaksanaan Pelatihan Manajemen Risiko 2. Rekapitulasi Capaian Pelatihan/Sertifikasi Manajemen Risiko 3. Hasil Evaluasi Pelatihan 4. Dokumen Tindak Lanjut Hasil Evaluasi Pelatihan', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Terdapat upaya peningkatan kompetensi dan keterampilan terkait manajemen risiko yang memadai dengan cakupan seluruh pegawai dan telah dievaluasi pencapaiannya', evidence: '1. Laporan Evaluasi Pelaksanaan Pelatihan Manajemen Risiko 2. Rekapitulasi Pegawai Bersertifikat/Kompeten Manajemen Risiko 3. Laporan Evaluasi Dampak Pelatihan terhadap Peningkatan Kompetensi/Keterampilan Manajemen Risiko 4. Bukti penggunaan kompetensi manajemen risiko dalam pelaksanaan tugas 5. Bukti perbaikan program pelatihan berdasarkan hasil evaluasi', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '1.6.3',
        desc: 'Pegawai memiliki kesadaran terkait manajemen risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Beberapa pegawai telah memiliki kesadaran pemahaman terkait manajemen risiko', evidence: 'Hasil Kuesioner/Survei Kesadaran Manajemen Risiko Pegawai + Rekapitulasi Hasil Kuesioner', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Sebagian kecil pegawai telah memiliki pemahaman terkait manajemen risiko', evidence: 'Hasil Kuesioner/Survei Kesadaran Manajemen Risiko Pegawai + Rekapitulasi Hasil Kuesioner + Daftar Peserta Sosialisasi/Pelatihan MR', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Sebagian pegawai telah memiliki pemahaman terkait manajemen risiko', evidence: 'Rekapitulasi Hasil Kuesioner Kesadaran Manajemen Risiko + Daftar Peserta Sosialisasi/Pelatihan MR + Bukti Keterlibatan Pegawai dalam Identifikasi/Penilaian Risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Sebagian besar pegawai telah memiliki pemahaman terkait manajemen risiko', evidence: 'Laporan Hasil Evaluasi Kesadaran Manajemen Risiko Pegawai + Rekapitulasi Hasil Kuesioner + Bukti Keterlibatan Pegawai dalam Pengelolaan Risiko + Dokumen Tindak Lanjut Hasil Evaluasi', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Seluruh pegawai telah memiliki pemahaman terkait manajemen risiko', evidence: 'Laporan Hasil Evaluasi Kesadaran dan Penerapan Manajemen Risiko Pegawai + Rekapitulasi Hasil Kuesioner + Bukti Keterlibatan Pegawai dalam Pengelolaan Risiko + Bukti Tindak Lanjut/Perbaikan Penerapan MR', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.7': {
    label: '1.7 Perwujudan Peran APIP yang Efektif',
    params: [
      {
        id: '1.7.1',
        desc: 'Pengawasan APIP telah dapat memberikan nilai tambah pada perbaikan pengendalian organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Tidak ada praktik yang tetap, tidak ada kapabilitas yang berulang dan tergantung pada kinerja individu (Level 1 Initial).', evidence: '1. Surat Tugas Pengawasan 2. Laporan Hasil Pengawasan (LHP)', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Proses audit dilakukan secara tetap (rutin) dan berulang (Level 2 Infrastructure).', evidence: '1. PKPT (Program Kerja Pengawasan Tahunan) 2. Surat Tugas Pengawasan 3. Program Kerja Audit/Pengawasan (PKA) 4. Kertas Kerja Pengawasan (Kertas Kerja) 5. Laporan Hasil Pengawasan (LHP)', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Praktik profesional dan audit internal telah ditetapkan secara seragam (Level 3 Integrated).', evidence: '1. Piagam Audit Intern (Audit Charter) 2. Pedoman/Standar Audit Intern APIP 3. SOP/Pedoman Pelaksanaan Pengawasan 4. Program Kerja Pengawasan/Audit 5. Kertas Kerja Audit/Pengawasan 6. Laporan Hasil Pengawasan (LHP) 7. Dokumen Reviu Berjenjang/Quality Assurance, jika ada', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'APIP telah mengintegrasikan semua informasi di seluruh organisasi untuk memperbaiki tata kelola dan manajemen risiko (Level 4 Managed).', evidence: '1. PKPT berbasis risiko 2. Risk Register/Profil Risiko Pemerintah Daerah yang digunakan APIP 3. Hasil Penilaian Risiko sebagai dasar penyusunan PKPT 4. Laporan Hasil Pengawasan yang memuat perbaikan tata kelola/manajemen risiko 5. Database hasil pengawasan/temuan dan tindak lanjut 6. Laporan Pemantauan Tindak Lanjut Hasil Pengawasan', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'APIP telah menjadi unit yang terus belajar baik dari dalam maupun dari luar organisasi untuk perbaikan berkelanjutan (Level 5 Optimizing).', evidence: '1. Laporan Evaluasi Kapabilitas APIP/IACM 2. Rencana Tindak Lanjut Peningkatan Kapabilitas APIP 3. Laporan Tindak Lanjut Peningkatan Kapabilitas APIP 4. Hasil Telaahan Sejawat (Peer Review) 5. Dokumen Benchmarking/Studi Tiru APIP, jika ada 6. Dokumen inovasi/perbaikan metode pengawasan berdasarkan hasil evaluasi/lesson learned', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '1.8': {
    label: '1.8 Hubungan Kerja yang Baik dengan Instansi Pemerintah Terkait',
    params: [
      {
        id: '1.8.1',
        desc: 'Pimpinan K/L/D menjalin hubungan kerja yang baik (kemitraan) dengan instansi lain terkait dengan upaya pencapaian tujuan organisasi.',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi menetapkan mekanisme hubungan kerja/tata cara kerjasama dengan instansi lain.', evidence: '1. Nota Kesepahaman (MoU) / Perjanjian Kerja Sama (PKS) 2. SOP/Mekanisme Pelaksanaan Kerja Sama 3. Surat Keputusan/Surat Tugas Tim Pelaksana Kerja Sama, jika ada', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Publikasi kebijakan kerjasama organisasi kepada para pihak yang berkepentingan.', evidence: '1. Dokumen/SOP Kerja Sama 2. Surat/Undangan Sosialisasi Kerja Sama 3. Notulen/Daftar Hadir Rapat/Sosialisasi Kerja Sama 4. Dokumentasi penyampaian mekanisme kerja sama', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Masing-masing pihak melaksanakan kegiatan sesuai dengan lingkup kewenangan masing-masing sesuai kebijakan dan ukuran kinerja yang ditetapkan.', evidence: '1. Laporan Pelaksanaan Kerja Sama 2. Notulen/BA Rapat Koordinasi dengan Mitra 3. Berita Acara Pertukaran/Penyampaian Data dan Informasi 4. Dokumentasi pelaksanaan kegiatan bersama 5. Laporan hasil kegiatan kerja sama', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Pelaksanaan kebijakan kerjasama organisasi dievaluasi secara berkala.', evidence: '1. Laporan Evaluasi Pelaksanaan Kerja Sama 2. Notulen/BA Evaluasi Kerja Sama 3. Daftar/Matriks Hambatan dan Tindak Lanjut Kerja Sama 4. Laporan Tindak Lanjut Hasil Evaluasi 5. Adendum/Perubahan PKS atau SOP, jika ada', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pelaksanaan hubungan kerja yang baik dengan mitra kerjasama organisasi menghasilkan efektivitas pencapaian tujuan organisasi dan efisiensi penggunaan sumberdaya masing-masing instansi.', evidence: '1. Laporan Evaluasi Dampak/Manfaat Kerja Sama 2. Laporan Capaian/Hasil Kerja Sama 3. Dokumen tindak lanjut/pengembangan kerja sama 4. Adendum/Perubahan PKS berdasarkan hasil evaluasi, jika ada 5. Bukti pemanfaatan bersama sumber daya/data/informasi 6. Dokumen rencana/pengembangan kerja sama lanjutan', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '1.8.2',
        desc: 'Dalam rangka menciptakan hubungan kerja yang baik, K/L/D telah mengidentifikasi, menilai, dan mengelola risiko (termasuk implikasi dari transfer risiko) terkait kemitraan',
        levels: [
          { grade: 'E', level: 1, desc: 'Instansi Pemerintah telah memiliki kebijakan pengelolaan risiko terkait kemitraan namun belum diterapkan sama sekali', evidence: '1. Kebijakan/Pedoman Manajemen Risiko 2. SOP/Pedoman Pengelolaan Risiko Kemitraan/ Kerja Sama, jika ada', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Instansi Pemerintah telah memiliki kebijakan pengelolaan risiko terkait kemitraan namun belum diterapkan dengan memadai', evidence: '1. Kebijakan/Pedoman Manajemen Risiko 2. Risk Register Kemitraan/Kerja Sama 3. Dokumen Identifikasi dan Penilaian Risiko Kemitraan 4. Rencana Mitigasi Risiko Kemitraan', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Instansi Pemerintah telah memiliki kebijakan pengelolaan risiko terkait kemitraan dan telah diterapkan dengan memadai', evidence: '1. Daftar/Inventarisasi Kemitraan/Kerja Sama 2. Risk Register masing-masing Kemitraan Penting 3. Dokumen Identifikasi dan Penilaian Risiko Kemitraan 4. Rencana/Tindakan Mitigasi Risiko Kemitraan 5. Monitoring Pelaksanaan Mitigasi Risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Instansi Pemerintah telah memiliki kebijakan pengelolaan risiko terkait kemitraan dan penerapannya telah terintegrasi dengan proses bisnis Instansi Pemerintah', evidence: '1. Dokumen Perencanaan Kegiatan Kemitraan yang memuat risiko 2. Risk Register Kemitraan 3. Rencana Mitigasi Risiko 4. Dokumen Kinerja/Perjanjian Kinerja yang mempertimbangkan risiko kemitraan 5. Notulen/BA Rapat Pengambilan Keputusan yang mempertimbangkan risiko kemitraan, jika ada', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Instansi Pemerintah telah memiliki kebijakan pengelolaan risiko terkait kemitraan, penerapannya telah terintegrasi dengan proses bisnis Instansi Pemerintah, telah direviu secara berkala dan dijadikan bahan pembelajaran', evidence: '1. Laporan Reviu/Evaluasi Pengelolaan Risiko Kemitraan 2. Risk Register Kemitraan yang telah diperbarui 3. Matriks Tindak Lanjut Hasil Reviu 4. Dokumen perbaikan kebijakan/SOP pengelolaan risiko kemitraan 5. Dokumen pembelajaran/lesson learned hasil pengelolaan risiko kemitraan, jika ada', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '2.1': {
    label: '2.1 Identifikasi Risiko',
    params: [
      {
        id: '2.1.1',
        desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko namun sama sekali belum memuat persyaratan dalam kriteria memadai.', evidence: '1. Perkada tentang Manajemen Risiko 2. SK/SE Kepala Daerah/Kepala OPD tentang penerapan Manajemen Risiko 3. Pedoman Manajemen Risiko', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko namun belum memadai.', evidence: '1. Kebijakan/Pedoman Manajemen Risiko 2. Lampiran/Matriks Penerapan Manajemen Risiko', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko yang memadai.', evidence: 'Pedoman Manajemen Risiko yang memuat 8 kriteria', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko yang memadai dan terintegrasi.', evidence: '1. Pedoman/Kebijakan Manajemen Risiko 2. Risk Register seluruh unit kerja 3. Dokumen Perencanaan yang memuat hasil manajemen risiko 4. Dokumen Kinerja yang memuat risiko dan mitigasi 5. Notulen/Berita Acara Pengambilan Keputusan yang mempertimbangkan risiko 6. Laporan Penerapan Manajemen Risiko', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'K/L/D telah memiliki Kebijakan Manajemen Risiko yang memadai, terintegrasi serta telah direviu secara berkala.', evidence: '1. Laporan Reviu/Evaluasi Kebijakan Manajemen Risiko 2. Risk Register yang telah diperbarui 3. Matriks Tindak Lanjut Hasil Reviu 4. Dokumen Perbaikan/Pemutakhiran Kebijakan Manajemen Risiko 5. Dokumen pembelajaran/lesson learned', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.1.2',
        desc: 'Risiko telah teridentifikasi dan dituangkan dalam register risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Register risiko telah disusun', evidence: 'Risk Register OPD', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kualitas identifikasi risiko dan register risiko belum memadai', evidence: '1. Risk Register OPD 2. Dokumen Penetapan Konteks/Ruang Lingkup Manajemen Risiko 3. Notulen / Berita Acara Dokumen Identifikasi Risiko', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Kualitas identifikasi risiko dan register risiko cukup memadai', evidence: '1. Risk Register OPD 2. Dokumen Identifikasi Risiko 3. Berita Acara/Notulen Identifikasi Risiko 4. Daftar Peserta/Daftar Hadir Identifikasi Risiko 5. Hasil Kuesioner/Penilaian Pemahaman Pegawai tentang Proses Bisnis', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kualitas identifikasi risiko dan register risiko memadai', evidence: '1. Risk Register OPD 2. Dokumen Identifikasi dan Penilaian Risiko 3. Berita Acara/Notulen Identifikasi Risiko 4. Daftar Hadir Peserta Identifikasi Risiko 5. Hasil Kuesioner/Penilaian Pemahaman Proses Bisnis peserta/Pegawai', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Kualitas identifikasi risiko dan register risiko memadai, serta telah mengidentifikasi peluang', evidence: '1. Risk Register OPD yang telah direviu/dimutakhirkan 2. Laporan Hasil Reviu Risk Register 3. Berita Acara Identifikasi dan Reviu Risiko 4. Hasil Kuesioner/Penilaian Pemahaman Pegawai 5. Risk Register yang memuat risiko dan peluang 6. Matriks Tindak Lanjut Hasil Reviu Risiko', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.1.3',
        desc: 'Proses manajemen risiko telah melekat pada proses bisnis K/L/D',
        levels: [
          { grade: 'E', level: 1, desc: 'Proses manajemen risiko mulai dihubungkan dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja namun belum diterapkan secara konsisten', evidence: '1. Risk Register Unit Kerja 2. Renja/RKA/DPA/Rencana Aksi 3. Rencana Tindak Pengendalian (RTP)', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Proses manajemen risiko telah terintegrasi dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja serta telah diterapkan secara konsisten', evidence: '1. Risk Register Unit Kerja 2. RTP 3. SOP/Proses Bisnis Unit Kerja yang telah mempertimbangkan risiko 4. Renja/RKA/DPA/Rencana Aksi', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Proses manajemen risiko telah diterapkan secara konsisten, terintegrasi dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja dan strategis unit kerja', evidence: '1. Risk Register Unit Kerja 2. Renstra/Perjanjian Kinerja/Renja Unit Kerja yang mempertimbangkan risiko 3. RTP 4.KAK Kegiatan yang Mempertimbangkan Hasil Manajemen Risiko 5. SOP/Proses Bisnis yang mempertimbangkan risiko', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Proses manajemen risiko telah diterapkan secara konsisten, terintegrasi dengan proses bisnis dan proses perencanaan tingkat operasional unit kerja, strategis unit kerja, dan strategis K/L/D', evidence: '1. Risk Register OPD 2. Renstra/RPJMD atau dokumen strategis yang mempertimbangkan risiko 3. Renja/Perjanjian Kinerja yang mempertimbangkan risiko 4. RTP 5. Notulen Rapat Pimpinan yang Memuat Pembahasan dan Tindak Lanjut Hasil Manajemen Risiko', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Proses manajemen risiko mendukung inovasi, diidentifikasi untuk memaksimalkan peluang dan dijadikan bahan pembelajaran', evidence: '1. Laporan Evaluasi Penerapan Manajemen Risiko 2. Risk Register yang memuat risiko dan peluang 3. Nota Dinas/Notulen Rapat/Telaahan Staf Hasil Analisis Risiko 4. Dokumen inovasi/perbaikan proses berdasarkan hasil MR 5. Dokumen lesson learned/tindak lanjut hasil evaluasi MR', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '2.2': {
    label: '2.2 Analisis Risiko',
    params: [
      {
        id: '2.2.1',
        desc: 'Seluruh risiko telah dianalisis dampak dan tingkat keterjadiannya',
        levels: [
          { grade: 'E', level: 1, desc: 'Analisis risiko telah dilakukan terhadap sebagian risiko operasional yang teridentifikasi.', evidence: 'Dokumen analisis risiko (minimal daftar risiko).', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Analisis risiko telah dilakukan terhadap seluruh risiko operasional yang teridentifikasi namun belum memadai.', evidence: 'Dokumen analisis risiko yang belum sesuai kriteria sistematis.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Analisis risiko telah dilakukan secara memadai terhadap risiko operasional unit kerja.', evidence: 'Dokumen analisis risiko sesuai kebijakan (kriteria konsisten, oleh orang berkompeten).', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Analisis risiko telah dilakukan secara memadai terhadap risiko operasional unit kerja dan risiko strategis unit kerja.', evidence: 'Dokumen analisis risiko level operasional dan strategis unit kerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Analisis risiko telah dilakukan secara memadai terhadap risiko operasional unit kerja, risiko strategis unit kerja, dan risiko strategis K/L/D.', evidence: 'Dokumen analisis risiko level operasional, strategis unit kerja, dan strategis K/L/D.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.2.2',
        desc: 'K/L/D telah menentukan prioritas risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Instansi Pemerintah telah menentukan prioritas risiko pada sebagian risiko operasional unit kerja', evidence: 'Dokumen evaluasi risiko sebagian.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Instansi Pemerintah telah menentukan prioritas risiko pada seluruh risiko operasional unit kerja', evidence: 'Dokumen evaluasi risiko operasional.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Instansi Pemerintah telah menentukan prioritas risiko pada seluruh risiko operasional unit kerja dan sebagian risiko strategis unit kerja', evidence: 'Dokumen evaluasi risiko operasional dan sebagian strategis.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Instansi Pemerintah telah menentukan prioritas risiko pada seluruh risiko operasional unit kerja dan strategis unit kerja', evidence: 'Dokumen evaluasi risiko operasional dan strategis unit kerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Instansi Pemerintah telah menentukan prioritas risiko pada seluruh risiko operasional unit kerja, strategis unit kerja, strategis K/L/D', evidence: 'Dokumen evaluasi risiko semua level.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.2.3',
        desc: 'K/L/D telah menentukan rencana tindak pengendalian',
        levels: [
          { grade: 'E', level: 1, desc: 'Instansi Pemerintah telah menentukan rencana tindak pengendalian terhadap sebagian risiko operasional unit kerja yang telah diprioritaskan', evidence: 'RTP sebagian.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Instansi Pemerintah telah menentukan rencana tindak pengendalian terhadap seluruh risiko operasional unit kerja yang telah diprioritaskan', evidence: 'RTP operasional.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Instansi Pemerintah telah menentukan rencana tindak pengendalian terhadap seluruh risiko operasional unit kerja dan sebagian risiko strategis unit kerja yang telah diprioritaskan', evidence: 'RTP operasional dan sebagian strategis.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Instansi Pemerintah telah menentukan rencana tindak pengendalian terhadap risiko operasional unit kerja dan strategis unit kerja secara memadai', evidence: 'RTP operasional dan strategis unit kerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Instansi Pemerintah telah menentukan rencana tindak pengendalian terhadap risiko operasional unit kerja, strategis unit kerja, dan strategis K/L/D secara memadai', evidence: 'RTP semua level.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.2.4',
        desc: 'Tindak pengendalian telah diimplementasikan',
        levels: [
          { grade: 'E', level: 1, desc: 'Tindak pengendalian terhadap sebagian risiko operasional unit kerja telah diimplementasikan', evidence: 'Bukti implementasi sebagian.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Tindak pengendalian terhadap seluruh risiko operasional unit kerja telah diimplementasikan', evidence: 'Bukti implementasi operasional.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Tindak pengendalian terhadap seluruh risiko operasional unit kerja dan sebagian risiko strategis unit kerja telah diimplementasikan', evidence: 'Bukti implementasi operasional dan sebagian strategis.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Tindak pengendalian terhadap seluruh risiko operasional unit kerja dan risiko strategis unit kerja telah diimplementasikan', evidence: 'Bukti implementasi operasional dan strategis unit kerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Tindak pengendalian terhadap seluruh risiko operasional unit kerja, risiko strategis unit kerja, dan risiko strategis K/L/D telah diimplementasikan', evidence: 'Bukti implementasi semua level.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '2.2.5',
        desc: 'Tindak pengendalian efektif menurunkan risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Tindak pengendalian efektif menurunkan sebagian risiko operasional unit kerja', evidence: 'Bukti penurunan sebagian.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Tindak pengendalian efektif menurunkan seluruh risiko operasional unit kerja', evidence: 'Bukti penurunan operasional.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Tindak pengendalian efektif menurunkan seluruh risiko operasional unit kerja dan sebagian risiko strategis unit kerja', evidence: 'Bukti penurunan operasional dan sebagian strategis.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Tindak pengendalian telah efektif menurunkan risiko operasional unit kerja dan strategis unit kerja', evidence: 'Bukti penurunan operasional dan strategis unit kerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Tindak pengendalian telah efektif menurunkan risiko operasional unit kerja, strategis unit kerja, dan strategis K/L/D', evidence: 'Bukti penurunan semua level.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.1': {
    label: '3.1 Reviu atas Kinerja Instansi Pemerintah',
    params: [
      {
        id: '3.1.1',
        desc: 'Pimpinan K/L/D membandingkan tolok ukur kinerja dengan capaian kinerja secara berkala untuk mengatasi hambatan kinerja, menetapkan strategi perbaikan, dan menilai kinerja suatu unit sampai dengan periode tertentu dalam rangka mengawal pencapaian tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi dan jajaran di bawahnya secara berjenjang memiliki tanggungjawab/kewajiban untuk melaksanakan reviu kinerja secara berkala.', evidence: 'Kebijakan/prosedur terkait pelaksanaan reviu kinerja organisasi, unit kerja, kegiatan, dan pegawai.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kewajiban pelaksanaan reviu kinerja diketahui oleh seluruh pimpinan unit dan pegawai.', evidence: 'Dokumen target kinerja dan tolok ukur yang diketahui pimpinan dan pegawai.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Reviu kinerja organisasi dilaksanakan dan didokumentasikan dengan baik untuk dibandingkan pengaruhnya terhadap capaian kinerja periode berikutnya.', evidence: 'Dokumen reviu berjenjang, rekomendasi/arahan pimpinan, dan bukti pelaksanaan rekomendasi.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan pelaksanaan reviu kinerja organisasi oleh masing-masing jenjang pimpinan telah dievaluasi secara berkala.', evidence: 'Laporan evaluasi kebijakan reviu kinerja, matriks tindak lanjut.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pelaksanaan reviu kinerja mendukung pencapaian kinerja organisasi.', evidence: 'Dokumen perbaikan kinerja berkelanjutan, penetapan kebijakan berdasarkan hasil reviu, dan alokasi sumber daya.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.2': {
    label: '3.2 Pembinaan SDM',
    params: [
      {
        id: '3.2.1',
        desc: 'Pembinaan SDM dilakukan sesuai peraturan perundangan yang berlaku sehingga setiap pegawai dapat memberikan manfaat optimal dalam pencapaian tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur pembinaan SDM untuk mendukung pelaksanaan tugas dan fungsi organisasi.', evidence: 'Kebijakan yang mengatur prosedur diklat, pengembangan karir, penilaian kinerja, kompensasi, dan kesejahteraan pegawai.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pembinaan SDM telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pembinaan SDM, daftar hadir, notulen.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pembinaan SDM telah dilaksanakan sesuai kebijakan/prosedur yang ditetapkan organisasi.', evidence: 'Dokumen perencanaan pembinaan SDM, bukti pelaksanaan diklat, analisis gap kompetensi.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait pembinaan SDM organisasi telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi pembinaan SDM, matriks tindak lanjut hasil evaluasi.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pembinaan SDM organisasi telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Laporan pengembangan SDM, bukti keterkaitan pembinaan SDM dengan pencapaian kinerja organisasi.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.3': {
    label: '3.3 Pengendalian atas Pengelolaan Sistem Informasi',
    params: [
      {
        id: '3.3.1',
        desc: 'Pengendalian atas pengelolaan sistem informasi dilakukan untuk memastikan sistem informasi dapat menyajikan data yang akurat dan tepat waktu untuk digunakan oleh pengguna',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi menetapkan kebijakan/grand design pengelolaan sistem informasi.', evidence: 'Dokumen kebijakan/grand design sistem informasi yang mempertimbangkan risiko, otorisasi, aset TI, struktur pengelola, pemisahan fungsi, dan contingency plan.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Unit pengelola sistem informasi organisasi dan pengguna mengetahui kebijakan pengelolaan sistem informasi.', evidence: 'Bukti sosialisasi kebijakan pengelolaan sistem informasi, pemahaman pengelola dan pengguna.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Kebijakan pengelolaan sistem informasi organisasi digunakan dalam analisis kebutuhan dukungan sistem informasi, kemanfaatan sistem informasi existing, serta struktur pengelola dan pengguna sistem informasi beserta wewenang dan tanggungjawabnya.', evidence: 'Dokumen analisis kemanfaatan sistem informasi, pemetaan aset TI, struktur pengelola dan pengguna sistem informasi, dan SOP pengelolaan sistem informasi.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan pengendalian atas pengelolaan sistem informasi organisasi telah dievaluasi secara berkala.', evidence: 'Laporan evaluasi pengelolaan sistem informasi, matriks tindak lanjut, bukti perbaikan kualitas informasi.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan terkait pengelolaan sistem informasi organisasi dilakukan secara berkelanjutan.', evidence: 'Dokumen integrasi sistem, perbaikan berkelanjutan sesuai perubahan lingkungan strategis, bukti dukungan sistem terhadap pencapaian tujuan.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.4': {
    label: '3.4 Pengendalian Fisik atas Aset',
    params: [
      {
        id: '3.4.1',
        desc: 'Pengelolaan BMN/D dilakukan untuk menjamin aset tersedia dan dapat digunakan dengan baik oleh pengguna dalam rangka mendukung kinerja organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi menetapkan kebijakan/prosedur pengelolaan BMN/D.', evidence: 'Kebijakan pengelolaan aset yang memuat perencanaan, pengadaan, penggunaan, pemanfaatan, pengamanan, pemeliharaan, penilaian, pemindahtanganan, pemusnahan, penghapusan, penatausahaan, dan pembinaan pengawasan.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan pengelolaan aset organisasi dipahami oleh pengelola aset dan pengguna aset.', evidence: 'Bukti sosialisasi kebijakan pengelolaan aset kepada seluruh pejabat dan pegawai.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Kebijakan/prosedur pengelolaan atas aset organisasi termasuk pengamanan fisik atas aset diimplementasikan secara memadai.', evidence: 'Dokumen pengamanan aset, inventarisasi fisik, pemeliharaan, dan bukti penanganan kejadian risiko aset.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan/prosedur pengelolaan atas aset organisasi termasuk pengamanan fisik atas aset dievaluasi secara berkala.', evidence: 'Laporan evaluasi pengelolaan aset, matriks tindak lanjut, bukti peningkatan kepuasan penggunaan aset.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan berkelanjutan atas pengelolaan aset organisasi.', evidence: 'Dokumen sistem pengendalian aset terintegrasi, tidak ada aset rusak berat/ringan, tidak ada keluhan pengguna, dan tidak ada aset pribadi untuk keperluan organisasi.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.5': {
    label: '3.5 Penetapan dan Reviu atas Indikator dan Ukuran Kinerja',
    params: [
      {
        id: '3.5.1',
        desc: 'Kegiatan pengendalian atas penetapan dan reviu atas indikator dan ukuran kinerja dilakukan untuk menjamin keandalan ukuran dan ketepatan penetapan indikator masing-masing unit secara berjenjang dibandingkan dengan IKU organisasi.',
        levels: [
          { grade: 'E', level: 1, desc: 'Pimpinan organisasi menetapkan kebijakan/prosedur penetapan dan reviu atas indikator dan ukuran kinerja.', evidence: 'Dokumen kebijakan/prosedur penetapan dan reviu indikator kinerja tingkat unit, kegiatan, dan individu.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan/prosedur penetapan dan reviu atas indikator dan ukuran kinerja organisasi dipahami namun belum sepenuhnya diimplementasikan.', evidence: 'Dokumen prosedur penetapan indikator, bukti pemahaman unit perencanaan kinerja.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Kebijakan/prosedur penetapan dan reviu atas indikator dan ukuran kinerja organisasi dilaksanakan secara memadai.', evidence: 'Dokumen reviu dan validasi indikator kinerja secara periodik.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan/prosedur penetapan dan reviu atas indikator dan ukuran kinerja organisasi dievaluasi secara berkala.', evidence: 'Laporan reviu indikator kinerja, bukti perbaikan perumusan indikator, dan dokumen indikator yang tepat dan andal.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan berkelanjutan atas penetapan dan reviu atas indikator dan ukuran kinerja organisasi.', evidence: 'Dokumen perbaikan berkelanjutan atas kebijakan/prosedur penetapan indikator yang menghasilkan pencapaian tujuan.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.6': {
    label: '3.6 Pemisahan Fungsi',
    params: [
      {
        id: '3.6.1',
        desc: 'Terdapat pemisahan fungsi sehingga seluruh aspek utama transaksi dan kejadian tidak dikendalikan hanya oleh satu orang',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur pemisahan fungsi dalam proses transaksi dan kejadian.', evidence: 'Kebijakan yang mengatur pemisahan tanggung jawab otorisasi, persetujuan, pemrosesan, pencatatan, pembayaran, dan reviu.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pemisahan fungsi dalam proses transaksi dan kejadian telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pemisahan fungsi, pemahaman penanggungjawab keuangan/kegiatan.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pemisahan fungsi dalam proses transaksi dan kejadian telah dilaksanakan sesuai kebijakan/prosedur yang ditetapkan.', evidence: 'Dokumen struktur organisasi, SOP, dan bukti pelaksanaan pemisahan fungsi pada keuangan dan teknis operasional.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait pemisahan fungsi dalam proses transaksi dan kejadian telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi pemisahan fungsi, matriks tindak lanjut, bukti perbaikan kinerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pemisahan fungsi telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen pemisahan fungsi yang mampu memitigasi risiko kolusi dan penyalahgunaan wewenang serta meningkatkan efektivitas program.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.7': {
    label: '3.7 Otorisasi atas Transaksi dan Kejadian yang Penting',
    params: [
      {
        id: '3.7.1',
        desc: 'Terdapat proses untuk memastikan transaksi dan kejadian penting hanya dapat diotorisasi ketika memenuhi persyaratan dan dilakukan oleh pihak yang memiliki kewenangan',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur prosedur otorisasi atas transaksi dan kejadian.', evidence: 'Kebijakan yang mengatur kondisi/syarat spesifik transaksi dapat diotorisasi dan pihak yang berwenang.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait otorisasi atas transaksi dan kejadian telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan otorisasi, pemahaman penanggungjawab keuangan/kegiatan.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Otorisasi atas transaksi dan kejadian telah dilaksanakan sesuai kebijakan/prosedur yang ditetapkan.', evidence: 'Dokumen otorisasi sesuai ketentuan, bukti pelaksanaan pada keuangan dan kegiatan teknis operasional.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait otorisasi atas transaksi dan kejadian telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi otorisasi, matriks tindak lanjut, bukti perbaikan kinerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Proses otorisasi atas transaksi dan kejadian telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen fungsi otorisasi yang mampu menyesuaikan perubahan lingkungan strategis dan memitigasi risiko kolusi.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.8': {
    label: '3.8 Pencatatan yang Akurat dan Tepat Waktu atas Transaksi dan Kejadian',
    params: [
      {
        id: '3.8.1',
        desc: 'Terdapat proses untuk memastikan transaksi telah diklasifikasikan dengan layak dan dikelompokkan dengan benar serta dicatat dengan segera sehingga relevan, bernilai, dan berguna bagi manajemen',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur prosedur pencatatan atas transaksi dan kejadian.', evidence: 'Kebijakan yang mengatur mekanisme pencatatan seluruh siklus transaksi, klasifikasi, dan tenggat waktu.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pencatatan atas transaksi dan kejadian telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pencatatan, pemahaman penanggungjawab keuangan/kegiatan.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pencatatan atas transaksi dan kejadian telah dilaksanakan sesuai kebijakan/prosedur yang ditetapkan.', evidence: 'Dokumen pencatatan sesuai ketentuan, bukti pelaksanaan pada keuangan dan teknis operasional.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait pencatatan atas transaksi dan kejadian telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi pencatatan, matriks tindak lanjut, bukti perbaikan kualitas informasi.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pencatatan atas transaksi dan kejadian telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen proses pencatatan yang mampu menyesuaikan perubahan lingkungan strategis, memitigasi risiko manipulasi, dan menghasilkan informasi bernilai.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.9': {
    label: '3.9 Pembatasan Akses atas Sumber Daya dan Pencatatannya',
    params: [
      {
        id: '3.9.1',
        desc: 'Terdapat pembatasan atas kesempatan dan hak untuk menggunakan, atau memperoleh sumber daya dan mengakses pencatatannya',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur prosedur pembatasan akses terhadap sumber daya yang dimiliki organisasi beserta pencatatannya.', evidence: 'Kebijakan yang mengatur mekanisme/desain pembatasan akses terhadap sumber daya dan pencatatannya.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pembatasan akses terhadap sumber daya dan pencatatannya telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pembatasan akses, pemahaman penanggungjawab keuangan dan BMN/BMD.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Terhadap sumber daya dan pencatatannya telah dilakukan pembatasan akses sesuai dengan ketentuan.', evidence: 'Dokumen pembatasan akses sesuai ketentuan, bukti pertimbangan nilai aset dan kemudahan dipindahkan, bukti reviu periodik.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait pembatasan akses terhadap sumber daya dan pencatatannya telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi pembatasan akses, matriks tindak lanjut, bukti perbaikan kinerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pembatasan akses terhadap sumber daya dan pencatatannya telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen pembatasan akses yang mampu menyesuaikan perubahan lingkungan strategis, memitigasi risiko penggunaan tidak sah, dan menghasilkan zero significant fraudulent/dangerous intrusion.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.10': {
    label: '3.10 Akuntabilitas terhadap Sumber Daya dan Pencatatannya',
    params: [
      {
        id: '3.10.1',
        desc: 'Terdapat pertanggungjawaban seseorang atau unit organisasi dalam mengelola sumber daya yang diberikan/dikuasakan kepadanya dalam rangka pencapaian tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur prosedur pertanggungjawaban sumber daya dan pencatatannya.', evidence: 'Kebijakan yang mengatur mekanisme pertanggungjawaban penyimpanan, penggunaan, dan pencatatan sumber daya, serta penetapan pihak yang bertanggungjawab.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait pertanggungjawaban sumber daya dan pencatatannya telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pertanggungjawaban, pemahaman penanggungjawab keuangan dan BMN/BMD.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Sumber daya dan pencatatannya telah dipertanggungjawabkan oleh pihak/pegawai yang ditetapkan sesuai kebijakan/prosedur yang ditetapkan.', evidence: 'Dokumen pertanggungjawaban sesuai ketentuan, bukti perbandingan berkala antara sumber daya dengan pencatatannya.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Kebijakan dan implementasi terkait akuntabilitas sumber daya dan pencatatannya telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi akuntabilitas sumber daya, matriks tindak lanjut, bukti perbaikan kinerja.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pertanggungjawaban terhadap sumber daya dan pencatatannya telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen pertanggungjawaban yang mampu menyesuaikan perubahan lingkungan strategis, memitigasi risiko penggunaan tidak sah, dan telah dibagi habis kepada pihak yang berwenang.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '3.11': {
    label: '3.11 Dokumentasi yang Baik atas SPI serta Transaksi dan Kejadian Penting',
    params: [
      {
        id: '3.11.1',
        desc: 'Terdapat pengelolaan, pemeliharaan, dan pendokumentasian secara berkala yang mencakup seluruh SPI serta transaksi dan kejadian penting yang dilaksanakan secara lengkap dan akurat untuk memfasilitasi penelusuran transaksi, kejadian, dan informasi terkait',
        levels: [
          { grade: 'E', level: 1, desc: 'Terdapat kebijakan yang mengatur prosedur pendokumentasian atas SPI serta transaksi dan kejadian penting.', evidence: 'Kebijakan yang mengatur pendokumentasian manual dan elektronik, mencakup seluruh pengendalian serta transaksi dan kejadian penting.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Kebijakan terkait prosedur pendokumentasian atas SPI serta transaksi dan kejadian penting telah dikomunikasikan dan dipahami oleh pihak yang berkepentingan.', evidence: 'Bukti sosialisasi kebijakan pendokumentasian, pemahaman penanggungjawab pengelolaan dokumen/arsip.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pendokumentasian atas SPI serta transaksi dan kejadian penting telah dilaksanakan sesuai kebijakan/prosedur yang ditetapkan.', evidence: 'Dokumen pengelolaan, pemeliharaan, dan pemutakhiran catatan secara berkala, termasuk pendokumentasian keuangan dan teknis operasional.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Pendokumentasian atas SPI serta transaksi dan kejadian penting telah dievaluasi sehingga dapat diketahui efektivitasnya.', evidence: 'Laporan evaluasi pendokumentasian, matriks tindak lanjut, bukti perbaikan kualitas dokumen.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Pendokumentasian atas SPI serta transaksi dan kejadian penting telah diperbaiki secara berkelanjutan dan secara optimal mampu mendukung pencapaian tujuan organisasi.', evidence: 'Dokumen pendokumentasian yang mampu menyesuaikan perubahan lingkungan strategis dan menghasilkan dokumen yang relevan, bernilai, dan berguna secara real time.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '4.1': {
    label: '4.1 Informasi yang Relevan',
    params: [
      {
        id: '4.1.1',
        desc: 'Tersedianya informasi yang relevan untuk kebutuhan internal dan eksternal',
        levels: [
          { grade: 'E', level: 1, desc: 'Ketersediaan informasi yang relevan untuk mendukung pengendalian intern tidak lengkap.', evidence: 'Bukti belum tersedianya informasi produk, layanan, keuangan, kepegawaian, dan manajemen kinerja secara lengkap.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Informasi yang relevan untuk mendukung pengendalian intern tersedia secara lengkap namun tidak mudah diperoleh/akses terbatas.', evidence: 'Dokumen informasi yang tersedia lengkap namun akses terbatas.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Informasi yang relevan untuk mendukung pengendalian intern tersedia secara lengkap dan mudah untuk diperoleh.', evidence: 'Dokumen informasi produk, layanan, keuangan, kepegawaian, dan manajemen kinerja yang tersedia lengkap dan mudah diakses.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Klasifikasi informasi telah dievaluasi dan ditindaklanjuti sehingga dapat disajikan dengan tepat waktu, andal, dan relevan.', evidence: 'Laporan evaluasi klasifikasi informasi, bukti perbaikan prosedur pengelolaan informasi, bukti penyajian informasi tepat waktu, andal, dan relevan.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Informasi yang disajikan relevan dan memenuhi ekspektasi stakeholder.', evidence: 'Dokumen informasi produk, standar, prosedur layanan, dan pengaduan yang telah memenuhi ekspektasi stakeholder.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '4.1.2',
        desc: 'Pimpinan K/L/D membangun sistem pengaduan',
        levels: [
          { grade: 'E', level: 1, desc: 'Telah terdapat kebijakan penerapan sistem pengaduan', evidence: 'Sudah Jelas', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Keberadaan sistem pengaduan telah disosialisasikan kepada masyarakat/stakeholder', evidence: 'Sudah Jelas', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Sistem pengaduan telah diterapkan dan ditindaklanjuti sesuai Kebijakan/SOP', evidence: 'Sudah Jelas', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Sistem pengaduan telah dievaluasi', evidence: 'Kebijakan dan implementasi telah dievaluasi dengan ketentuan: - Berkala - Terdokumentasi - Dilakukan untuk menangani residual risk - Hasil evaluasi telah ditindak lanjuti - Perbaikan telah menghasilkan kinerja yang lebih baik', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Sistem pengaduan berdampak pada perbaikan berkelanjutan', evidence: 'Perbaikan berkelanjutan antara lain berdampak pada peningkatan kinerja, perbaikan pelayanan publik, dan kepuasan stakeholder.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '4.1.3',
        desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan.',
        levels: [
          { grade: 'E', level: 1, desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan pada sebagian pegawai pada tingkat operasional unit kerja', evidence: '<60% pegawai sample pada tingkat operasional unit kerja menunjukan pengetahuan akan strategi dan kebijakan yang telah ditetapkan', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan pada seluruh pegawai pada tingkat operasional unit kerja', evidence: '>60% pegawai sample pada tingkat operasional unit kerja menunjukan pengetahuan akan strategi dan kebijakan yang telah ditetapkan', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan pada seluruh pegawai pada tingkat operasional unit kerja dan sebagian pegawai pada tingkat strategis unit kerja', evidence: '>60% pegawai sample pada tingkat operasional unit kerja dan <60% pada tingkat strategis unit kerja menunjukan pengetahuan akan strategi dan kebijakan yang telah ditetapkan', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan pada seluruh pegawai pada tingkat operasional unit kerja dan tingkat strategis unit kerja', evidence: '>60% pegawai sample pada tingkat operasional unit kerja dan strategis unit kerja menunjukan pengetahuan akan strategi dan kebijakan yang telah ditetapkan', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Strategi dan kebijakan manajemen risiko telah dikomunikasikan pada seluruh pegawai pada tingkat operasional unit kerja, tingkat strategis unit kerja, dan tingkat strategis K/L/D', evidence: '>60% pegawai sample pada tingkat operasional unit kerja, strategis unit kerja, dan strategis K/L/D menunjukan pengetahuan akan strategi dan kebijakan yang telah ditetapkan', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '4.1.4',
        desc: 'Register risiko dan rencana tindak pengendalian telah dikomunikasikan ke pihak terkait',
        levels: [
          { grade: 'E', level: 1, desc: 'Register risiko dan rencana tindak pengendalian tingkat operasional unit kerja telah dikomunikasikan kepada sebagian pihak terkait', evidence: 'Komunikasi Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD tidak dilakukan kepada semua pihak yang telah diidentifikasi dalam rencana komunikasi sebagaimana tertuang dalam dokumen RTP yang telah disusun sebelumnya.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Register risiko dan rencana tindak pengendalian tingkat operasional unit kerja/OPD dan strategis unit kerja/OPD telah dikomunikasikan kepada seluruh pihak terkait', evidence: 'Komunikasi Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD dan strategis Unit Kerja/OPD telah dilakukan kepada semua pihak yang telah diidentifikasi dalam rencana komunikasi sebagaimana tertuang dalam dokumen RTP yang telah disusun sebelumnya.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Register risiko dan rencana tindak pengendalian operasional Unit Kerja/OPD, strategis Unit Kerja/OPD dan Strategis K/L/D telah dikomunikasikan kepada seluruh pihak terkait', evidence: 'Komunikasi Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD, strategis Unit Kerja/OPD dan strategis K/L/D telah dilakukan kepada semua pihak yang telah diidentifikasi dalam rencana komunikasi sebagaimana tertuang dalam dokumen RTP yang telah disusun sebelumnya.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD, strategis Unit Kerja/OPD dan Strategis K/L/D telah dikomunikasikan kepada seluruh pihak terkait dan dijadikan bahan dalam pengambilan keputusan', evidence: 'Komunikasi Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD, dan strategis Unit Kerja/OPD telah dilakukan kepada semua pihak yang telah diidentifikasi dalam rencana komunikasi sebagaimana tertuang dalam dokumen RTP yang telah disusun sebelumnya dan dijadikan bahan pembuatan keputusan oleh pihak-pihak tersebut.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD, strategis Unit Kerja/OPD dan Strategis K/L/D telah dikomunikasikan kepada seluruh pihak terkait dan dijadikan bahan dalam pengambilan keputusan serta menjadi bahan pembelajaran dan inovasi', evidence: 'Komunikasi Register risiko dan rencana tindak pengendalian tingkat operasional Unit Kerja/OPD, dan strategis Unit Kerja/OPD telah dilakukan kepada semua pihak yang telah diidentifikasi dalam rencana komunikasi sebagaimana tertuang dalam dokumen RTP yang telah disusun sebelumnya dan dijadikan bahan pembuatan keputusan oleh pihak-pihak tersebut serta menjadi bahan pembelajaran dan inovasi bagi K/L/D', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '4.2': {
    label: '4.2 Komunikasi yang Efektif',
    params: [
      {
        id: '4.2.1',
        desc: 'Terlaksananya komunikasi yang efektif dengan internal dan eksternal',
        levels: [
          { grade: 'E', level: 1, desc: 'Komunikasi yang efektif dengan eksternal belum dilakukan.', evidence: 'Bukti belum adanya promosi/sosialisasi produk, layanan, dan komunikasi untuk mengatasi isu negatif.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Komunikasi yang efektif telah dilakukan kepada internal dan eksternal namun belum terstruktur dan berkala.', evidence: 'Bukti promosi/sosialisasi produk dan komunikasi pengarahan visi, misi, dan risiko yang belum terstruktur dan berkala.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Komunikasi yang efektif telah dilakukan kepada internal dan eksternal secara terstruktur dan berkala.', evidence: 'Dokumen promosi/sosialisasi produk, komunikasi pengarahan visi, misi, dan komunikasi risiko yang dilakukan secara terstruktur dan berkala.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Komunikasi yang efektif telah dilakukan kepada internal dan eksternal secara terstruktur dan berkala dan telah dievaluasi.', evidence: 'Laporan evaluasi kepuasan layanan, survei citra instansi, dan bukti perbaikan komunikasi.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan berkelanjutan atas metodologi komunikasi yang efektif.', evidence: 'Dokumen upaya promosi/sosialisasi yang berhasil meningkatkan kepercayaan publik dan memperbaiki citra instansi.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '5.1': {
    label: '5.1 Pemantauan Berkelanjutan',
    params: [
      {
        id: '5.1.1',
        desc: 'Pimpinan organisasi/penanggungjawab program dan kegiatan/penanggungjawab operasional mengevaluasi secara berkala pengendalian intern yang telah dilakukan dalam rangka mencapai tujuan organisasi',
        levels: [
          { grade: 'E', level: 1, desc: 'Pemantauan pelaksanaan pengendalian telah dilaksanakan.', evidence: 'Dokumen pemantauan pelaksanaan pengendalian dan pemantauan pelaksanaan kinerja.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Pemantauan pelaksanaan pengendalian telah dilaksanakan pada sebagian aktivitas pengendalian dan terkait pemantauan kinerja telah dilaksanakan pada level program dan kegiatan.', evidence: 'Dokumen pemantauan sebagian aktivitas pengendalian, pemantauan kinerja level program dan kegiatan.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Pemantauan pelaksanaan pengendalian telah dilaksanakan pada seluruh aktivitas pengendalian dan terkait pemantauan kinerja telah dilaksanakan pada level program, kegiatan, unit kerja level dibawahnya sampai dengan pemantauan kinerja individu, namun hasil pemantauan belum dikelola.', evidence: 'Dokumen pemantauan seluruh aktivitas pengendalian, pemantauan kinerja sampai individu, namun hasil belum dikelola.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Seluruh hasil pemantauan berkelanjutan dikelola dan ditindaklanjuti.', evidence: 'Laporan pengelolaan hasil pemantauan, bukti tindak lanjut hasil pemantauan, bukti komunikasi hasil pemantauan.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan berkelanjutan atas pemantauan pengendalian intern dilaksanakan dan berdampak pada kualitas pengendalian intern.', evidence: 'Dokumen pemantauan yang efektif mengurangi dampak dan frekuensi risiko, sistem informasi terintegrasi untuk pemantauan realtime, dan pemantauan kinerja digunakan sebagai dasar reward and punishment.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '5.1.2',
        desc: 'Proses manajemen risiko telah direviu',
        levels: [
          { grade: 'E', level: 1, desc: 'Sudah dilakukan reviu atas sebagian risiko operasional unit kerja', evidence: 'Kebijakan, framework, metode, tahapan, proses, dan praktik yang dijalankan terkait dengan proses manajemen risiko belum direviu oleh pihak internal dari Instansi Pemerintah (oleh APIP maupun komite manajemen risiko) dan hanya atas sebagian risiko operasional unit kerja', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Sudah dilakukan reviu atas seluruh risiko operasional unit kerja', evidence: 'Kebijakan, framework, metode, tahapan, proses, dan praktik yang dijalankan terkait dengan proses manajemen risiko telah direviu oleh pihak internal dari Instansi Pemerintah (oleh APIP maupun komite manajemen risiko) tetapi hanya atas risiko operasional unit kerja', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Sudah dilakukan reviu atas seluruh risiko operasional unit kerja dan strategis unit kerja', evidence: 'Kebijakan, framework, metode, tahapan, proses, dan praktik yang dijalankan terkait dengan proses manajemen risiko telah direviu oleh pihak internal dari Instansi Pemerintah (oleh APIP maupun komite manajemen risiko) tetapi hanya atas risiko operasional unit kerja dan strategis unit kerja', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Sudah dilakukan reviu atas seluruh risiko operasional unit kerja, strategis unit kerja, dan strategis K/L/D', evidence: 'Kebijakan, framework, metode, tahapan, proses, dan praktik yang dijalankan terkait dengan proses manajemen risiko telah direviu oleh pihak internal dari Instansi Pemerintah (oleh APIP maupun komite manajemen risiko) untuk semua risiko operasional unit kerja, strategis unit kerja, strategis K/L/D', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Sudah dilakukan reviu atas seluruh risiko operasional unit kerja, strategis unit kerja, dan strategis K/L/D dan hasil reviu dijadikan bahan perbaikan organisasi', evidence: 'Kebijakan, framework, metode, tahapan, proses, dan praktik yang dijalankan terkait dengan proses manajemen risiko telah direviu oleh pihak internal dari Instansi Pemerintah (oleh APIP maupun komite manajemen risiko) untuk semua risiko operasional unit kerja, strategis unit kerja, strategis K/L/D. Hasil reviu telah seluruhnya ditindaklanjuti dan sudah ada implementasi perbaikan atas hasil reviu tersebut.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '5.1.3',
        desc: 'Pemantauan/monitoring terhadap risiko telah dilakukan',
        levels: [
          { grade: 'E', level: 1, desc: 'Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja/OPD namun belum memadai', evidence: 'Belum memadai berarti: 1. Monitoring dilakukan tidak sesuai jadwal yang ditetapkan; 2. Monitoring dilakukan oleh atasan langsung unit UPR dan dilaksanakan minimal satu kali dalam satu tahun; 3. Proses dan hasil Monitoring tidak didokumentasikan; 4. Monitoring belum sepenuhnya dilakukan terhadap: a. implementasi pengendalian; b. kejadian risiko (termasuk mekanisme dan implementasi pelaporan segera); c. Memantau pelaksanaan tiap tahapan pengelolaan risiko. 5. Hasil monitoring menunjukkan kondisi yang belum baik; 6. Hasil Monitoring tidak ditindaklanjuti.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja/OPD secara memadai', evidence: 'Memadai berarti: 1.Telah ada langkah Monitoring sesuai kebijakan; 2. Monitoring dilakukan sesuai dengan jadwal yang ditetapkan sesuai kebijakan; 3. Monitoring dilakukan oleh unit kepatuhan dan dilaksanakan minimal satu kali per semester atau sesuai dengan kebutuhan; 4. Proses dan hasil Monitoring telah didokumentasikan; 5. Monitoring sepenuhnya dilakukan terhadap: a. implementasi pengendalian; b. kejadian risiko (termasuk mekanisme dan implementasi pelaporan segera); c. Memantau pelaksanaan tiap tahapan pengelolaan risiko. 6. Hasil monitoring menunjukkan kondisi yang baik; 7. Hasil Monitoring sebagian telah diditindaklanjuti.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja/OPD dan strategis unit kerja/OPD secara memadai', evidence: 'Memadai berarti: 1.Telah ada langkah Monitoring sesuai kebijakan; 2. Monitoring dilakukan sesuai dengan jadwal yang ditetapkan sesuai kebijakan; 3. Monitoring dilakukan oleh unit kepatuhan dan dilaksanakan minimal satu kali per semester atau sesuai dengan kebutuhan; 4. Proses dan hasil Monitoring telah didokumentasikan; 5. Monitoring sepenuhnya dilakukan terhadap: a. implementasi pengendalian; b. kejadian risiko (termasuk mekanisme dan implementasi pelaporan segera); c. Memantau pelaksanaan tiap tahapan pengelolaan risiko. 6. Hasil monitoring menunjukkan kondisi yang baik; 7. Hasil Monitoring sebagian telah diditindaklanjuti.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja/OPD, strategis unit kerja/OPD dan strategis K/L/D secara memadai', evidence: 'Memadai berarti: 1.Telah ada langkah Monitoring sesuai kebijakan; 2. Monitoring dilakukan sesuai dengan jadwal yang ditetapkan sesuai kebijakan; 3. Monitoring dilakukan oleh unit kepatuhan dan dilaksanakan minimal satu kali per semester atau sesuai dengan kebutuhan; 4. Proses dan hasil Monitoring telah didokumentasikan; 5. Monitoring sepenuhnya dilakukan terhadap: a. implementasi pengendalian; b. kejadian risiko (termasuk mekanisme dan implementasi pelaporan segera); c. Memantau pelaksanaan tiap tahapan pengelolaan risiko. 6. Hasil monitoring menunjukkan kondisi yang baik; 7. Hasil Monitoring sebagian telah diditindaklanjuti.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Monitoring terhadap risiko dan tindak pengendalian dilakukan terhadap risiko operasional unit kerja, strategis unit kerja, dan strategis K/L/D secara memadai dan menjadi bahan pembelajaran bagi unit kerja', evidence: 'Memadai berarti: 1.Telah ada langkah Monitoring sesuai kebijakan; 2. Monitoring dilakukan sesuai dengan jadwal yang ditetapkan sesuai kebijakan; 3. Monitoring dilakukan oleh unit kepatuhan dan dilaksanakan minimal satu kali per semester atau sesuai dengan kebutuhan; 4. Proses dan hasil Monitoring telah didokumentasikan; 5. Monitoring sepenuhnya dilakukan terhadap: a. implementasi pengendalian; b. kejadian risiko (termasuk mekanisme dan implementasi pelaporan segera); c. Memantau pelaksanaan tiap tahapan pengelolaan risiko. 6. Hasil monitoring menunjukkan kondisi yang baik; 7. Hasil Monitoring seluruhnya telah ditindaklanjuti. 8. Terdapat implementasi perbaikan atas hasil monitoring', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  },
  '5.2': {
    label: '5.2 Evaluasi Terpisah',
    params: [
      {
        id: '5.2.1',
        desc: 'Evaluasi terpisah dilakukan oleh pegawai dengan keahlian tertentu yang disyaratkan dan dapat melibatkan APIP atau auditor eksternal untuk menilai kinerja sistem pengendalian intern, mengidentifikasi kelemahan pengendalian, menentukan penyebab dari kegagalan aktivitas pengendalian, serta pengaruhnya terhadap pencapaian tujuan instansi.',
        levels: [
          { grade: 'E', level: 1, desc: 'Evaluasi terpisah atas pengendalian intern dan pelaksanaan program/kegiatan telah dilaksanakan', evidence: '- Evaluasi atas pelaksanaan pengendalian intern telah dilaksanakan; - Evaluasi atas pelaksanaan program/kegiatan telah dilaksanakan.', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Evaluasi terpisah telah dilaksanakan pada sebagian aktivitas pengendalian dan seluruh program dan kegiatan serta dilaksanakan oleh pihak yang kompeten dengan metodologi yang tepat', evidence: '- Evaluasi dilakukan pada sebagian aktivitas pengendalian. Evaluasi dianggap dilaksanakan jika: a. Dilaksanakan oleh pihak yang kompeten dan independen; b. Evaluasi menilai kecukupan pelaksanaan pengendalian (maturitas dan efektifitas pengendalian); c. Memberikan rekomendasi yang relevan. - Evaluasi dilakukan pada sebagian program kegiatan. a. Dilaksanakan oleh pihak yang kompeten dan independen; b. Evaluasi menilai keselarasan prgram dan program dengan sasaran; c. Memberikan rekomendasi yang relevan.', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Evaluasi terpisah telah dilaksanakan pada seluruh aktivitas pengendalian dan seluruh program dan kegiatan serta dilaksanakan oleh pihak yang kompeten dan dengan metodologi yang tepat, namun hasil evaluasi terpisah belum ditindaklanjuti seluruhnya', evidence: '- Evaluasi dilakukan pada seluruh aktivitas pengendalian. Evaluasi dianggap dilaksanakan jika: a. Dilaksanakan oleh pihak yang kompeten dan independen; b. Evaluasi menilai kecukupan pelaksanaan pengendalian (maturitas dan efektifitas pengendalian); c. Memberikan rekomendasi yang relevan; d. Rekomendasi perbaikan telah ditindaklanjuti sebagian. - Evaluasi dilakukan pada seluruh program kegiatan. Evaluasi dianggap dilaksanakan jika: a. Dilaksanakan oleh pihak yang kompeten dan independen; b. Evaluasi menilai keselarasan prgram dan program dengan sasaran; c. Memberikan rekomendasi yang relevan; d. Rekomendasi perbaikan telah ditindaklanjuti sebagian.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Seluruh hasil evaluasi terpisah dikelola dan ditindaklanjuti', evidence: 'Seluruh hasil evaluasi terpisah dikelola dan ditindaklanjuti. Pengelolaan hasil antara lain dilakukan dengan dokumentasi yang baik dan monitoring atas penyelesaian tindak lanjut hasil evaluasi terpisah.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Perbaikan berkelanjutan atas pelaksanaan evaluasi terpisah berdampak pada peningkatan kualitas pengendalian intern dan pencapaian tujuan organisasi', evidence: '- Hasil tindak lanjut mampu mengurangi dampak dan frekuensi risiko. - Hasil tindak lanjut mampu mengakselerasi pencapaian indikator program dan kegiatan.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      },
      {
        id: '5.2.2',
        desc: 'Terdapat reviu independen terhadap proses manajemen risiko',
        levels: [
          { grade: 'E', level: 1, desc: 'Reviu terhadap proses tindak pengendalian untuk risiko tingkat operasional unit kerja/OPD belum memadai', evidence: 'Belum memadai berarti: 1. Reviu dilakukan tidak sesuai jadwal yang ditetapkan; 2. Belum ada pedoman reviu yang terstandar 3. Reviu dilakukan oleh APIP dan dilaksanakan minimal satu kali per tahun; 4. Proses dan hasil reviu telah didokumentasikan; 5. Reviu dilakukan untuk mereviu rencana dan implementasi pengendalian serta kejadian risiko serta respon yang dilakukan 6. Hasil reviu menunjukkan sebagian kecil kondisi yang ada sesuai dengan standar dan kebijakan; 7. Hasil reviu belum ditindaklanjuti;', note: 'E – Kebijakan/Formalitas' },
          { grade: 'D', level: 2, desc: 'Reviu terhadap proses tindak pengendalian untuk risiko tingkat operasional unit kerja/OPD cukup memadai', evidence: 'Cukup memadai berarti: 1. Reviu dilakukan tidak sesuai jadwal yang ditetapkan; 2. Belum ada pedoman reviu yang terstandar 3. Reviu dilakukan oleh APIP dan dilaksanakan minimal satu kali per tahun; 4. Proses dan hasil reviu telah didokumentasikan; 5. Reviu dilakukan untuk mereviu rencana dan implementasi pengendalian serta kejadian risiko serta respon yang dilakukan 6. Hasil reviu menunjukkan sebagian kondisi yang ada sesuai dengan standar dan kebijakan; 7. Hasil reviu sebagian kecil ditindaklanjuti;', note: 'D – Komunikasi & Pemahaman' },
          { grade: 'C', level: 3, desc: 'Reviu terhadap proses tindak pengendalian untuk risiko tingkat operasional unit kerja/OPD dan strategis unit kerja/OPD memadai', evidence: 'Memadai berarti: 1.Telah ada pedoman reviu yang terstandar; 2. Reviu dilakukan sesuai dengan jadwal yang ditetapkan dan pedoman yang terstandar; 3. Reviu dilakukan oleh APIP dan dilaksanakan minimal satu kali per tahun; 4. Proses dan hasil reviu telah didokumentasikan; 5. Reviu dilakukan untuk mereviu rencana dan implementasi pengendalian serta kejadian risiko serta respon yang dilakukan 6. Hasil reviu menunjukkan sebagian besar kondisi yang ada telah sesuai dengan standar dan kebijakan serta dapat disimpulkan baik; 7. Hasil reviu sebagian besar telah diditindaklanjuti.', note: 'C – Implementasi' },
          { grade: 'B', level: 4, desc: 'Reviu terhadap proses tindak pengendalian untuk risiko tingkat operasional unit kerja/OPD, strategis unit kerja/OPD, dan strategis K/L/D memadai', evidence: 'Memadai berarti: 1.Telah ada pedoman reviu yang terstandar yang merunjuk pada best practice; 2. Reviu dilakukan sesuai dengan jadwal yang ditetapkan dan sesuai dengan pedoman; 3. Reviu dilakukan oleh APIP minimal satu kali per tahun; 4. Proses dan hasil reviu telah didokumentasikan; 5. Reviu dilakukan untuk mereviu rencana dan implementasi pengendalian serta kejadian risiko serta respon yang dilakukan 6. Hasil reviu menunjukkan sebagian besar kondisi yang ada telah sesuai dengan standar dan kebijakan serta dapat disimpulkan baik; 7. Hasil reviu sebagian besar telah diditindaklanjuti.', note: 'B – Evaluasi & Tindak Lanjut' },
          { grade: 'A', level: 5, desc: 'Reviu terhadap proses tindak pengendalian risiko tingkat operasional unit kerja/OPD, strategis unit kerja/OPD, dan strategis K/L/D sangat memadai', evidence: 'Sangat memadai berarti: 1.Telah ada pedoman reviu yang terstandar yang merunjuk pada best practice; 2. Reviu dilakukan sesuai dengan jadwal yang ditetapkan dan sesuai dengan pedoman; 3. Reviu dilakukan oleh APIP minimal satu kali per tahun; 4. Proses dan hasil reviu telah didokumentasikan serta dapat disimpulkan baik; 5. Reviu dilakukan untuk mereviu rencana dan implementasi pengendalian serta kejadian risiko serta respon yang dilakukan 6. Hasil reviu menunjukkan kondisi yang seluruhnya telah sesuai dengan standar dan kebijakan serta dapat disimpulkan baik; 7. Hasil reviu seluruhnya telah diditindaklanjuti; 8. Terdapat implementasi perbaikan atas hasil reviu.', note: 'A – Perbaikan Berkelanjutan' }
        ]
      }
    ]
  }
};
module.exports = { SUBUNSUR_DATA };
