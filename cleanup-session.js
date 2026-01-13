const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SESSION_PATH = path.join(__dirname, '.wwebjs_auth');

console.log('🧹 Membersihkan session WhatsApp...\n');

// Step 1: Try to kill other node processes (not this one)
console.log('🛑 Mencoba menghentikan proses Node.js lain...');
const killer = spawn('powershell.exe', [
    '-Command',
    `Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Id -ne ${process.pid}} | Stop-Process -Force`
]);

killer.on('close', () => {
    console.log('✅ Proses dihentikan\n');
    
    // Step 2: Wait for files to unlock
    console.log('⏳ Menunggu file unlock...');
    setTimeout(() => {
        deleteSession();
    }, 2000);
});

function deleteSession() {
    if (!fs.existsSync(SESSION_PATH)) {
        console.log('ℹ️  Tidak ada session yang perlu dibersihkan\n');
        console.log('✅ Siap start bot!');
        console.log('   Jalankan: npm start\n');
        process.exit(0);
        return;
    }

    console.log('🗑️  Menghapus session...\n');
    
    try {
        // Try to remove with force
        fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
        console.log(`✅ Berhasil menghapus session\n`);
        console.log('✅ Session berhasil dibersihkan!');
        console.log('📱 Anda sekarang bisa menjalankan bot lagi dengan:');
        console.log('   npm start\n');
        process.exit(0);
    } catch (error) {
        console.error(`❌ Error:`, error.message);
        console.log('\n⚠️ Tidak bisa hapus semua file');
        console.log('💡 Solusi:');
        console.log('   1. Tutup semua terminal/command prompt');
        console.log('   2. Hapus folder .wwebjs_auth secara manual');
        console.log('   3. Atau restart komputer\n');
        process.exit(1);
    }
}
