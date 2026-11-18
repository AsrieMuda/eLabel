# e-Label v1.0 — Prototaip UAT Interaktif

## Apa yang sudah berfungsi

- Dashboard dengan kad statistik, navigasi dan notifikasi simulasi.
- Pertukaran paparan peranan: KPP, MySTEP, Penyemak, Penjana Surat, TKPK (KA), Pemohon.
- MySTEP: borang permohonan 4 langkah dan ID automatik **demo**.
- KPP: agih satu permohonan kepada ramai penyemak.
- Penyemak: semua pegawai wajib hantar semakan sebelum ke penjana surat.
- Penjana Surat: pratonton draf contoh dan hantar ke TKPK.
- TKPK: simulasi pengesahan dan penyelesaian; tiada tandatangan sah.
- Pemohon: cari ID UAT dan lihat sejarah status.
- Data demo disimpan dalam localStorage pelayar. Tiada sambungan ke data sebenar dan tiada e-mel dihantar.

## Jalankan frontend

Buka `frontend/index.html` dalam pelayar, atau jalankan `python -m http.server 8080 --directory frontend` dari akar projek lalu buka `http://localhost:8080`.

Untuk GitHub Pages, letakkan fail `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`, dan `frontend/config.js` di root repositori (atau tetapkan Pages folder yang sesuai). Jangan letak data pemohon atau sebarang secret di GitHub.

## Database UAT

Google Sheet yang telah dijana: https://docs.google.com/spreadsheets/d/13j1HcYTD3cbff-jO9RgJdNDApSSlXNCkNdZOe0DDxYA/edit

13 tab: APPLICATIONS, COMPANIES, PRODUCTS, DOCUMENTS, USERS, TASKS, LABEL_REVIEWS, LETTERS, VERIFICATIONS, STATUS_HISTORY, AUDIT_LOG, NOTIFICATIONS, SETTINGS.

**PENTING:** Google Sheet ini berada dalam akaun Gmail pembangunan, bukan akaun `asrie@moh.gov.my`. Data Excel asal di Drive MOH tidak diubah.

## Backend Apps Script — peringkat scaffold

Kod `apps-script/Code.gs` ialah backend asas dengan operasi `whoami`, `dashboard`, `myTasks`, `register`, `assign`, `submitReview` dan log audit. Ia **belum dideploy atau dihubungkan** kepada frontend. Surat/PDF, muat naik Drive, OTP, e-mel sebenar, dan akses pemohon sebenar belum diimplementasi.

Untuk percubaan teknikal seterusnya:

1. Cipta projek Apps Script sendiri, masukkan `Code.gs` dan manifest (`appsscript.json`).
2. Dalam Project Settings → Script Properties tetapkan `SPREADSHEET_ID`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL=asrie@moh.gov.my`, `ENVIRONMENT=UAT`.
3. Sediakan OAuth Client ID (Web) dan konfigurasi Google Identity Services pada frontend yang diluluskan.
4. Lengkapkan USERS untuk pegawai yang dibenarkan; ID token akan disemak di Apps Script (`aud`, `iss`, `exp`, `email_verified`, `hd`).
5. Uji akses sebenar dan keserasian rangkaian. GitHub Pages → Apps Script Web App mungkin disekat oleh CORS/redirect. Untuk sambungan yang boleh diharap, gunakan penyelesaian yang diluluskan pentadbir seperti proxy/gateway atau host UI dalam Apps Script. **Jangan guna JSONP atau token rahsia yang didedahkan dalam frontend.**
6. Audit had kuota Apps Script dan Sheets, penyimpanan fail serta polisi data KKM sebelum data sebenar atau production.

## Status dan batasan keselamatan

`config.js` mengandungi konfigurasi awam sahaja, bukan token atau kata laluan. Role switcher hanyalah simulator; **bukan autentikasi**. Backend berasingan wajib mengesahkan identiti dan hak mengakses setiap permintaan. Portal pemohon perlu OTP/pautan token sekali guna dan minimisasi maklumat sebelum diaktifkan. Jangan dedahkan dokumen Drive kepada umum.

Tiada surat rasmi atau tandatangan digital sah dikeluarkan oleh prototaip ini. Data contoh menggunakan nama syarikat rekaan. SMTP dan notifikasi e-mel belum diaktifkan.

## Pelan versi

- **v1.0 UAT UI (ini):** frontend interaktif dan Apps Script scaffold.
- **v1.1:** integrasi Google Workspace login + API yang diuji hujung-ke-hujung.
- **v1.2:** dokumen Drive, pengesahan kelengkapan, templat surat, notifikasi dan audit penuh.
- **v1.3:** portal pemohon dengan pengesahan e-mel dan ujian migrasi.

## Jurnal ringkas

2026-11-18: UI berdasarkan lakaran dashboard KPP; database 13 tab sedia ada; pembangunan demo UAT dengan aliran role-based; backend awal dihasilkan tetapi belum dipasang. Ujian login/Google Sheets API sebenar masih tertangguh.


## v1.3 — Pembetulan Aliran Surat (18 Nov 2026)
- Role SIGNATORY/TKPK dikeluarkan. TKPK (KA) menandatangani surat di luar sistem.
- Pegawai Penjana Surat rekod tarikh hantar dan terima; upload PDF bertandatangan; kemudian simulasikan edaran.
- PDF UAT disimpan secara setempat dengan IndexedDB; boleh dimuat turun melalui portal pemohon pada pelayar/peranti sama.
- Tiada e-mel sebenar dihantar, tiada Drive upload sebenar, tiada kawalan login/OTP production.
- Backend Apps Script masih foundation dan BELUM menyokong workflow surat ini. Perlu API authenticated, private Drive file, status history dan mail queue sebelum production.
- Jangan letak data peribadi atau surat sebenar dalam prototaip.
