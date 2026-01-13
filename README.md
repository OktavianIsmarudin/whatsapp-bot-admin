# WhatsApp Bot Admin Dashboard - Masjid Al Iman Surabaya

Dashboard web untuk mengelola WhatsApp Bot auto-reply dengan AI support.

## 🎯 Fitur Utama

- ✅ Auto-reply berdasarkan keyword (28 keywords Masjid)
- ✅ AI-powered response dengan Groq LLaMA untuk pertanyaan tidak terdaftar
- ✅ Control panel start/stop bot dari web
- ✅ QR code scan langsung dari dashboard
- ✅ Kelola knowledge base & QA database
- ✅ Toggle auto-reply per kontak
- ✅ Daily contact reset
- ✅ Konfigurasi informasi masjid

## 🚀 Quick Start

### 1. Install
```bash
npm install
```

### 2. Start Bot
```bash
npm start
```

### 3. Open Dashboard
Buka browser: `http://localhost:3000`

### 4. Scan QR Code
Scan QR code yang muncul di terminal dengan WhatsApp di HP

## ⚠️ PENTING: Setelah Logout WhatsApp

Jika Anda logout/disconnect dari WhatsApp Web:

```bash
# Cleanup session
.\cleanup.bat

# Start lagi
npm start
```

**JANGAN** langsung klik "Start Bot" setelah logout! Gunakan cleanup dulu.

## ️ Commands

| Command | Fungsi |
|---------|--------|
| `npm start` | Start bot & server |
| `npm run cleanup` | Cleanup session (JS) |
| `.\cleanup.bat` | Cleanup session (BAT) |
| `npm run dev` | Start dengan nodemon |

## 📁 Struktur File Penting

```
├── server.js                    # Backend server
├── knowledge.json              # Database keyword & response
├── qa-database.json           # Q&A from konsultasisyariah.net
├── contacts.json              # Daftar kontak & settings
├── bot-config.json            # Konfigurasi masjid
├── public/
│   ├── index.html            # Dashboard UI
│   └── app.js                # Frontend logic
└── cleanup.bat               # Cleanup script
```

2. **Jalankan Server**
   ```bash
   npm start
   ```

3. **Buka Browser**
   ```
   http://localhost:3000
   ```

4. **Gunakan Dashboard**
   - Tab **Bot Control**: Start bot dan scan QR code
   - Tab **Knowledge Base**: Tambah/edit/hapus keyword dan respons
   - Tab **Configuration**: Setting info perusahaan

## 📝 Cara Menambah Knowledge

1. Buka tab **Knowledge Base**
2. Masukkan keyword (contoh: `halo`, `menu`, `info`)
3. Masukkan respons yang akan dikirim bot
4. Gunakan variabel untuk data dinamis:
   - `{companyName}` - Nama perusahaan
   - `{business}` - Bidang usaha
   - `{phone}` - Nomor telepon
   - `{email}` - Email
   - `{address}` - Alamat
   - `{operationalHours}` - Jam operasional
5. Klik **Simpan Keyword**

## ⚙️ Konfigurasi

Isi informasi perusahaan di tab **Configuration** agar bot dapat menggunakan data tersebut dalam respons otomatis.

## 🔧 Troubleshooting

- Pastikan port 3000 tidak digunakan aplikasi lain
- Bot dan dashboard menggunakan session WhatsApp yang sama
- Refresh halaman jika QR code tidak muncul

## 📦 Dependencies

- Express.js - Web server
- WhatsApp-Web.js - WhatsApp client
- Body-parser - Parse request body
- CORS - Cross-origin resource sharing
