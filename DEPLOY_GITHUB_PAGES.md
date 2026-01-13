# 🌐 Deploy Dashboard ke GitHub Pages dengan Ngrok

## ✅ Setup Selesai

**Ngrok URL:** https://5e1c20dd31a9.ngrok-free.app

URL ini sudah dikonfigurasi di `public/app.js`:
```javascript
const API_URL = 'https://5e1c20dd31a9.ngrok-free.app';
```

## 📋 Cara Aktifkan GitHub Pages

### 1. Buka Repository Settings
1. Buka: https://github.com/OktavianIsmarudin/whatsapp-bot-admin
2. Klik tab **Settings** (atas)
3. Klik **Pages** di menu kiri

### 2. Konfigurasi GitHub Pages
- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/public` atau `/ (root)`
- Klik **Save**

### 3. Tunggu Deploy (1-2 menit)
Refresh halaman, akan muncul:
```
Your site is live at https://oktavianismarudin.github.io/whatsapp-bot-admin/
```

## 🖥️ Server Harus Tetap Jalan

### Terminal 1: Node.js Server
```bash
npm start
```
✅ Server jalan di http://localhost:3000

### Terminal 2: Ngrok Tunnel  
```bash
ngrok http 3000
```
✅ Expose ke https://5e1c20dd31a9.ngrok-free.app

## 🌐 Akses Dashboard

### Lokal:
```
http://localhost:3000
```

### Via Ngrok:
```
https://5e1c20dd31a9.ngrok-free.app
```
(Klik "Visit Site" di warning page ngrok)

### Via GitHub Pages (setelah aktif):
```
https://oktavianismarudin.github.io/whatsapp-bot-admin/
```

## ⚠️ Penting: Update URL Ngrok

Jika restart ngrok, URL berubah. Update di `public/app.js`:
```javascript
const API_URL = 'https://[URL-BARU].ngrok-free.app';
```

Lalu push:
```bash
git add public/app.js
git commit -m "Update ngrok URL"
git push origin main
```

## 🎯 Cara Kerja

1. **Frontend (HTML/JS):** Di-host di GitHub Pages (gratis, statis)
2. **Backend (Node.js):** Jalan di laptop Anda (localhost:3000)
3. **Ngrok:** Bridge antara GitHub Pages dan server lokal

```
[GitHub Pages] → [Ngrok URL] → [Localhost:3000] → [WhatsApp Bot]
```

## ✨ Keuntungan

✅ Dashboard bisa diakses dari mana saja  
✅ Server tetap lokal, data aman  
✅ Gratis 100%  
✅ Perfect untuk demo/testing  
✅ Bisa kasih link ke dosen

## 📝 Troubleshooting

**Dashboard tidak load?**
- Cek `npm start` jalan
- Cek `ngrok http 3000` jalan
- Refresh halaman

**CORS error?**
- Ngrok handle CORS otomatis, seharusnya OK

**QR code tidak muncul?**
- Refresh dashboard
- Restart bot (Stop → Start)

---

**Status:** ✅ Ready untuk deploy ke GitHub Pages!
