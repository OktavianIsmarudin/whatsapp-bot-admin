@echo off
echo.
echo 🧹 Membersihkan Session WhatsApp Bot...
echo.

REM Kill all node processes
echo 🛑 Menghentikan proses Node.js...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

REM Delete session folder
echo 🗑️  Menghapus folder session...
if exist ".wwebjs_auth" (
    rmdir /s /q ".wwebjs_auth"
    echo ✅ Session berhasil dibersihkan!
) else (
    echo ℹ️  Tidak ada session yang perlu dibersihkan
)

echo.
echo ✅ Selesai! Anda bisa start bot lagi dengan: npm start
echo.
pause
