// Load environment variables
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq AI
// IMPORTANT: Set GROQ_API_KEY in .env file (local) or environment variables (production)
if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ WARNING: GROQ_API_KEY not set! AI responses will not work.');
}
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Configure multer untuk upload file
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        // Hanya terima file Excel
        const allowedTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel (.xls, .xlsx) yang diperbolehkan'));
        }
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// File untuk menyimpan data
const KNOWLEDGE_FILE = path.join(__dirname, 'knowledge.json');
const QA_DATABASE_FILE = path.join(__dirname, 'qa-database.json');
const CONFIG_FILE = path.join(__dirname, 'bot-config.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

// Inisialisasi WhatsApp Client
let client = null;
let isClientReady = false;
let isInitializing = false;
let qrCodeData = '';
let isCleaning = false;
let botReadyTimestamp = null; // Track kapan bot ready

// Load atau buat QA Database (Knowledge Base 2)
function loadQADatabase() {
    if (fs.existsSync(QA_DATABASE_FILE)) {
        return JSON.parse(fs.readFileSync(QA_DATABASE_FILE, 'utf8'));
    }
    return [];
}

// Simpan QA Database
function saveQADatabase(data) {
    if (!Array.isArray(data)) {
        console.warn('Warning: saveQADatabase received non-array data');
        data = [];
    }
    fs.writeFileSync(QA_DATABASE_FILE, JSON.stringify(data, null, 2));
}

// Cari jawaban di QA Database menggunakan similarity
function searchQADatabase(question) {
    const qaDatabase = loadQADatabase();
    if (qaDatabase.length === 0) return null;

    const questionLower = question.toLowerCase();
    
    // Cari exact match atau similarity tinggi
    for (const qa of qaDatabase) {
        const qaQuestionLower = qa.question.toLowerCase();
        
        // Exact match
        if (qaQuestionLower === questionLower) {
            return qa;
        }
        
        // Check if question contains tags
        if (qa.tags) {
            const tags = qa.tags.toLowerCase().split(',').map(t => t.trim());
            for (const tag of tags) {
                if (questionLower.includes(tag) && tag.length > 3) {
                    return qa;
                }
            }
        }
        
        // Check word overlap (simple similarity)
        const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
        const qaWords = qaQuestionLower.split(/\s+/).filter(w => w.length > 3);
        
        const matchCount = questionWords.filter(w => qaWords.includes(w)).length;
        const similarity = matchCount / Math.max(questionWords.length, qaWords.length);
        
        // If similarity > 60%, return this answer
        if (similarity > 0.6) {
            return qa;
        }
    }
    
    return null;
}

// Load atau buat knowledge base
function loadKnowledge() {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
        // Support both formats: array or object
        if (Array.isArray(data)) {
            return data;
        } else if (data.keywords && data.responses) {
            // Convert object format to array format
            return data.keywords.map(keyword => ({
                keyword: keyword,
                response: data.responses[keyword]
            }));
        }
        return data;
    }
    return [];
}

// Load atau buat config
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return {
        companyName: '[NAMA PERUSAHAAN]',
        business: '[BIDANG USAHA]',
        phone: '[+62xxx]',
        email: '[email@perusahaan.com]',
        address: '[Alamat Lengkap]',
        operationalHours: 'Senin-Jumat 08:00-17:00'
    };
}

// Load atau buat contacts
function loadContacts() {
    if (fs.existsSync(CONTACTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
        
        // Auto-reset jika sudah ganti hari
        const today = new Date().toDateString();
        if (data.lastResetDate !== today) {
            console.log(`🔄 Reset kontak - Hari baru: ${today}`);
            return {
                lastResetDate: today,
                contacts: []
            };
        }
        
        return data;
    }
    return {
        lastResetDate: new Date().toDateString(),
        contacts: []
    };
}

// Simpan contacts
function saveContacts(contactsData) {
    // Pastikan struktur data benar
    if (!contactsData.lastResetDate) {
        contactsData = {
            lastResetDate: new Date().toDateString(),
            contacts: Array.isArray(contactsData) ? contactsData : []
        };
    }
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contactsData, null, 2));
}

// Simpan knowledge base
function saveKnowledge(data) {
    // Always save as array format
    if (!Array.isArray(data)) {
        console.warn('Warning: saveKnowledge received non-array data');
        data = [];
    }
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2));
}

// Simpan config
function saveConfig(data) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// Inisialisasi bot
function initializeBot() {
    if (client) {
        return;
    }

    try {
        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        client.on('qr', (qr) => {
            console.log('📱 QR Code received');
            isInitializing = false; // Set false agar frontend bisa detect hasQRCode
            qrCodeData = qr;
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            console.log('✅ WhatsApp Bot siap!');
            isClientReady = true;
            isInitializing = false;
            qrCodeData = '';
            botReadyTimestamp = Date.now(); // Catat waktu bot ready
            console.log(`⏰ Bot ready timestamp: ${new Date(botReadyTimestamp).toLocaleString()}`);
        });

        client.on('authenticated', () => {
            console.log('✅ Autentikasi berhasil!');
        });

        client.on('auth_failure', (error) => {
            console.error('❌ Autentikasi gagal:', error);
            isClientReady = false;
            isInitializing = false;
            qrCodeData = '';
        });

        client.on('disconnected', (reason) => {
            console.log('⚠️ Bot terputus:', reason);
            isClientReady = false;
            isInitializing = false;
            botReadyTimestamp = null;
            isCleaning = true;
            
            // Jangan destroy client di sini, biarkan user manual cleanup
            console.log('⚠️ Session terputus. Silakan gunakan "npm run cleanup" lalu start lagi.');
            
            // Set flag cleaning untuk 30 detik
            setTimeout(() => {
                isCleaning = false;
                client = null;
                console.log('✅ Cleanup timeout selesai. Anda bisa coba start bot lagi.');
            }, 30000);
        });

        // Error handler untuk mencegah crash
        client.on('error', (error) => {
            console.error('❌ Client error:', error.message);
        });

        process.on('unhandledRejection', (error) => {
            console.error('❌ Unhandled rejection:', error);
        });

        // Handle pesan masuk
        client.on('message', async (message) => {
        try {
            // Abaikan grup
            if (message.from.includes('@g.us')) {
                return;
            }

            // Abaikan WhatsApp Status/Broadcast
            if (message.from.includes('status@broadcast') || message.isStatus || message.broadcast) {
                console.log('⏭️ Status/Broadcast diabaikan');
                return;
            }

            // Hanya terima chat pribadi (1-on-1)
            if (!message.from.includes('@c.us')) {
                console.log('⏭️ Bukan chat pribadi, diabaikan');
                return;
            }

            // Hanya balas pesan yang masuk SETELAH bot ready
            const messageTimestamp = message.timestamp * 1000; // Convert ke milliseconds
            if (botReadyTimestamp && messageTimestamp < botReadyTimestamp) {
                console.log(`⏭️ Pesan lama diabaikan (diterima saat bot offline): ${message.body.substring(0, 50)}...`);
                return;
            }

            const msgBody = message.body.toLowerCase().trim();
            const chatId = message.from;
            
            // Load data
            const contactsData = loadContacts();
            const knowledge = loadKnowledge();
            const config = loadConfig();

            // Find or create contact
            let contact = contactsData.contacts.find(c => c.number === chatId);
            if (!contact) {
                contact = {
                    number: chatId,
                    name: message._data.notifyName || chatId.split('@')[0],
                    autoReply: true, // Default: auto reply ON
                    lastMessage: message.body,
                    lastMessageTime: new Date().toISOString()
                };
                contactsData.contacts.push(contact);
            } else {
                contact.lastMessage = message.body;
                contact.lastMessageTime = new Date().toISOString();
                if (message._data.notifyName) {
                    contact.name = message._data.notifyName;
                }
            }
            
            saveContacts(contactsData);
            console.log(`📩 Pesan dari ${contact.name}: ${msgBody}`);

            // Only auto-reply if enabled for this contact
            if (!contact.autoReply) {
                console.log(`⏸️ Auto-reply DISABLED untuk ${contact.name}`);
                return;
            }

            // Cek apakah ada response untuk keyword ini (flexible matching)
            // Pertama cek exact match, lalu cek apakah keyword ada di dalam pesan
            let foundKnowledge = knowledge.find(item => 
                item.keyword.toLowerCase() === msgBody.toLowerCase()
            );
            
            // Jika tidak ada exact match, cari keyword yang ada di dalam pesan
            if (!foundKnowledge) {
                foundKnowledge = knowledge.find(item => {
                    const keyword = item.keyword.toLowerCase();
                    // Cek apakah keyword ada sebagai kata terpisah dalam pesan
                    const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
                    return wordBoundaryRegex.test(msgBody);
                });
                
                if (foundKnowledge) {
                    console.log(`🔍 Keyword ditemukan dalam pesan: "${foundKnowledge.keyword}"`);
                }
            }
            
            if (foundKnowledge) {
                const response = foundKnowledge.response
                    .replace(/{companyName}/g, config.companyName)
                    .replace(/{business}/g, config.business)
                    .replace(/{phone}/g, config.phone)
                    .replace(/{email}/g, config.email)
                    .replace(/{address}/g, config.address)
                    .replace(/{operationalHours}/g, config.operationalHours);
                
                await message.reply(response);
                console.log(`✅ Auto-reply sent to ${contact.name}`);
            } else {
                // Langkah 2: Cek QA Database (Knowledge Base 2)
                const qaResult = searchQADatabase(message.body);
                
                if (qaResult) {
                    console.log(`📚 Jawaban ditemukan di QA Database (ID: ${qaResult.id})`);
                    
                    let qaResponse = `${qaResult.answer}\n\n`;
                    qaResponse += `_Dijawab oleh: ${qaResult.ustadz}_`;
                    
                    if (qaResult.url) {
                        qaResponse += `\n🔗 ${qaResult.url}`;
                    }
                    
                    await message.reply(qaResponse);
                    console.log(`✅ QA Database response sent to ${contact.name}`);
                } else {
                    // Langkah 3: Jika tidak ada di QA Database, gunakan AI
                    try {
                        console.log(`🤖 Menggunakan AI untuk menjawab: ${msgBody}`);
                    
                    // Langkah 1: Deteksi apakah pertanyaan tentang hukum Islam/agama
                    const detectionPrompt = `Analisa apakah pertanyaan berikut adalah tentang hukum Islam, fatwa, aturan agama, atau konsultasi syariah.
Jawab hanya dengan "YA" jika tentang hukum Islam/agama, atau "TIDAK" jika pertanyaan umum lainnya.

Pertanyaan: ${message.body}

Jawab:`;

                    const detectionCompletion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: 'user',
                                content: detectionPrompt
                            }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.1,
                        max_tokens: 10
                    });

                    const isIslamicQuestion = detectionCompletion.choices[0]?.message?.content?.trim().toUpperCase().includes('YA');
                    console.log(`📊 Deteksi hukum Islam: ${isIslamicQuestion ? 'YA' : 'TIDAK'}`);

                    // Langkah 2: Generate jawaban sesuai dengan jenis pertanyaan
                    let systemPrompt;
                    if (isIslamicQuestion) {
                        // Untuk pertanyaan hukum Islam
                        systemPrompt = `Anda adalah asisten virtual untuk ${config.companyName}.

Informasi Organisasi:
- Nama: ${config.companyName}
- Jenis: ${config.business}
- Telepon: ${config.phone}
- Email: ${config.email}
- Alamat: ${config.address}
- Jam Operasional: ${config.operationalHours}

Tugas Anda:
1. Berikan jawaban UMUM dan SINGKAT tentang pertanyaan hukum Islam
2. Jangan berikan fatwa detail
3. Arahkan untuk konsultasi lebih lanjut ke ustad/ahli
4. Gunakan bahasa Indonesia yang sopan dan ramah
5. Maksimal 2-3 kalimat saja
6. Bersifat informatif namun berhati-hati

Jawab dengan nada ramah dan hati-hati.`;
                    } else {
                        // Untuk pertanyaan umum
                        systemPrompt = `Anda adalah asisten virtual untuk ${config.companyName}.

Informasi Organisasi:
- Nama: ${config.companyName}
- Jenis: ${config.business}
- Telepon: ${config.phone}
- Email: ${config.email}
- Alamat: ${config.address}
- Jam Operasional: ${config.operationalHours}

Tugas Anda:
1. Jawab pertanyaan tentang masjid dengan ramah dan informatif
2. Berikan informasi yang akurat berdasarkan data di atas
3. Jika ditanya tentang jadwal shalat, sarankan untuk menghubungi langsung
4. Jika ditanya tentang donasi/infaq, berikan informasi kontak
5. Gunakan bahasa Indonesia yang sopan dan ramah
6. Jawab dengan singkat dan jelas (maksimal 3-4 kalimat)
7. Jika tidak tahu, arahkan untuk menghubungi kontak resmi

Jawab dengan nada ramah dan membantu.`;
                    }

                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: message.body
                            }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        temperature: 0.7,
                        max_tokens: 500
                    });

                    const aiResponse = chatCompletion.choices[0]?.message?.content;
                    
                    if (aiResponse) {
                        let finalResponse;
                        if (isIslamicQuestion) {
                            // Tambahkan disclaimer hanya untuk pertanyaan hukum Islam
                            finalResponse = `${aiResponse}\n\n_Mohon maaf jika informasi kurang akurat. Untuk informasi lebih lengkap dan akurat, silakan kunjungi https://konsultasisyariah.net/ atau berkonsultasi langsung dengan ustad kami._`;
                            console.log(`✅ AI response (Islamic) sent to ${contact.name}`);
                        } else {
                            // Tanpa disclaimer untuk pertanyaan umum
                            finalResponse = aiResponse;
                            console.log(`✅ AI response (General) sent to ${contact.name}`);
                        }
                        
                        await message.reply(finalResponse);
                    }
                } catch (aiError) {
                    console.error('Error menggunakan AI:', aiError);
                    // Fallback jika AI error
                    await message.reply(`Terima kasih atas pesan Anda. Untuk informasi lebih lanjut, silakan hubungi kami di ${config.phone} atau ${config.email}.`);
                }
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

        client.initialize();
    } catch (error) {
        console.error('❌ Error initializing bot:', error);
        client = null;
        isClientReady = false;
        isInitializing = false;
    }
}

// API Routes

// Get bot status
app.get('/api/bot/status', (req, res) => {
    res.json({
        isReady: isClientReady,
        hasQRCode: qrCodeData !== '',
        isCleaning: isCleaning,
        isInitializing: isInitializing
    });
});

// Get QR Code
app.get('/api/bot/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else {
        res.json({ qr: null });
    }
});

// Start bot
app.post('/api/bot/start', (req, res) => {
    try {
        if (isCleaning) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot masih dalam proses cleanup. Silakan tunggu 30 detik atau jalankan "npm run cleanup"' 
            });
        }
        
        if (client || isInitializing) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bot sudah berjalan atau sedang diinisialisasi' 
            });
        }
        
        isInitializing = true;
        initializeBot();
        res.json({ success: true, message: 'Bot sedang diinisialisasi... Tunggu QR Code' });
    } catch (error) {
        isInitializing = false;
        res.status(500).json({ success: false, message: error.message });
    }
});

// Stop bot
app.post('/api/bot/stop', async (req, res) => {
    try {
        if (client) {
            console.log('🛑 Menghentikan bot...');
            isClientReady = false;
            botReadyTimestamp = null;
            isCleaning = true;
            
            // Kirim response dulu
            res.json({ success: true, message: 'Bot sedang dihentikan. Silakan tunggu 30 detik atau jalankan "npm run cleanup"' });
            
            // Destroy client di background
            setTimeout(async () => {
                try {
                    await client.destroy();
                    console.log('✅ Bot berhasil dihentikan');
                } catch (err) {
                    console.warn('⚠️ Warning saat destroy client (ini normal):', err.message);
                } finally {
                    // Tunggu lebih lama untuk file unlock
                    setTimeout(() => {
                        client = null;
                        isCleaning = false;
                        console.log('✅ Cleanup selesai. Anda bisa start bot lagi.');
                    }, 5000);
                }
            }, 500);
        } else {
            res.json({ success: true, message: 'Bot sudah tidak aktif' });
        }
    } catch (error) {
        console.error('Error stopping bot:', error.message);
        client = null;
        isClientReady = false;
        isCleaning = false;
        res.json({ success: true, message: 'Bot dihentikan (dengan error)' });
    }
});

// Get all keywords
app.get('/api/knowledge/keywords', (req, res) => {
    try {
        const knowledge = loadKnowledge();
        // Convert array to object format for frontend compatibility
        const result = {
            keywords: knowledge.map(item => item.keyword),
            responses: {}
        };
        knowledge.forEach(item => {
            result.responses[item.keyword] = item.response;
        });
        res.json(result);
    } catch (error) {
        console.error('Error loading keywords:', error);
        res.status(500).json({ keywords: [], responses: {} });
    }
});

// Add or update keyword
app.post('/api/knowledge/keyword', (req, res) => {
    try {
        const { keyword, response } = req.body;
        let knowledge = loadKnowledge();
        
        if (!keyword || !response) {
            return res.status(400).json({ success: false, message: 'Keyword dan response harus diisi' });
        }

        // Ensure knowledge is array
        if (!Array.isArray(knowledge)) {
            knowledge = [];
        }

        const keywordLower = keyword.toLowerCase().trim();
        
        // Find existing keyword
        const existingIndex = knowledge.findIndex(item => 
            item.keyword.toLowerCase() === keywordLower
        );
        
        if (existingIndex >= 0) {
            // Update existing
            knowledge[existingIndex].response = response;
        } else {
            // Add new
            knowledge.push({
                keyword: keywordLower,
                response: response
            });
        }

        saveKnowledge(knowledge);
        res.json({ success: true, message: 'Keyword berhasil disimpan' });
    } catch (error) {
        console.error('Error saving keyword:', error);
        res.status(500).json({ success: false, message: 'Error menyimpan keyword: ' + error.message });
    }
});

// Delete keyword
app.delete('/api/knowledge/keyword/:keyword', (req, res) => {
    try {
        const keyword = req.params.keyword.toLowerCase();
        let knowledge = loadKnowledge();
        
        // Ensure knowledge is array
        if (!Array.isArray(knowledge)) {
            knowledge = [];
        }
        
        // Filter out the keyword
        knowledge = knowledge.filter(item => 
            item.keyword.toLowerCase() !== keyword
        );
        
        saveKnowledge(knowledge);
        res.json({ success: true, message: 'Keyword berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).json({ success: false, message: 'Error menghapus keyword: ' + error.message });
    }
});

// Import keywords dari Excel
app.post('/api/knowledge/import-excel', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel tidak ditemukan' });
        }

        // Baca file Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert ke JSON
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Validasi format
        if (data.length === 0) {
            fs.unlinkSync(req.file.path); // Hapus file upload
            return res.status(400).json({ 
                success: false, 
                message: 'File Excel kosong' 
            });
        }

        // Load knowledge base yang ada
        let knowledge = loadKnowledge();
        if (!Array.isArray(knowledge)) {
            knowledge = [];
        }

        let imported = 0;
        let updated = 0;
        let errors = [];

        // Process setiap baris
        data.forEach((row, index) => {
            // Support berbagai nama kolom (keyword/Keyword/KEYWORD, response/Response/RESPONSE)
            const keyword = row.keyword || row.Keyword || row.KEYWORD || row.kata || row.Kata;
            const response = row.response || row.Response || row.RESPONSE || row.jawaban || row.Jawaban;

            if (!keyword || !response) {
                errors.push(`Baris ${index + 2}: Kolom keyword atau response kosong`);
                return;
            }

            const keywordLower = keyword.toString().toLowerCase().trim();
            const responseText = response.toString().trim();

            // Cek apakah keyword sudah ada
            const existingIndex = knowledge.findIndex(item => 
                item.keyword.toLowerCase() === keywordLower
            );

            if (existingIndex >= 0) {
                // Update existing
                knowledge[existingIndex].response = responseText;
                updated++;
            } else {
                // Add new
                knowledge.push({
                    keyword: keywordLower,
                    response: responseText
                });
                imported++;
            }
        });

        // Simpan ke file
        saveKnowledge(knowledge);

        // Hapus file upload
        fs.unlinkSync(req.file.path);

        res.json({ 
            success: true, 
            message: `Import berhasil! ${imported} keyword baru ditambahkan, ${updated} keyword diupdate.`,
            stats: {
                imported,
                updated,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.error('Error importing Excel:', error);
        
        // Hapus file upload jika ada error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error mengimport Excel: ' + error.message 
        });
    }
});

// Get config
app.get('/api/config', (req, res) => {
    try {
        const config = loadConfig();
        res.json(config);
    } catch (error) {
        console.error('Error loading config:', error);
        res.status(500).json({ error: 'Error memuat konfigurasi: ' + error.message });
    }
});

// ===== QA DATABASE (KNOWLEDGE BASE 2) ENDPOINTS =====

// Get all QA items
app.get('/api/qa-database', (req, res) => {
    try {
        const qaDatabase = loadQADatabase();
        res.json({ data: qaDatabase });
    } catch (error) {
        console.error('Error loading QA database:', error);
        res.status(500).json({ error: 'Error memuat QA database: ' + error.message });
    }
});

// Add or update QA item
app.post('/api/qa-database', (req, res) => {
    try {
        const { id, question, answer, ustadz, category, tags, url } = req.body;
        
        if (!question || !answer) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pertanyaan dan jawaban harus diisi' 
            });
        }

        let qaDatabase = loadQADatabase();
        
        if (id) {
            // Update existing
            const index = qaDatabase.findIndex(item => item.id === id);
            if (index >= 0) {
                qaDatabase[index] = {
                    id,
                    question,
                    answer,
                    ustadz: ustadz || '',
                    category: category || '',
                    tags: tags || '',
                    url: url || '',
                    updatedAt: new Date().toISOString()
                };
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: 'ID tidak ditemukan' 
                });
            }
        } else {
            // Add new
            const newId = qaDatabase.length > 0 
                ? Math.max(...qaDatabase.map(item => item.id || 0)) + 1 
                : 1;
            
            qaDatabase.push({
                id: newId,
                question,
                answer,
                ustadz: ustadz || '',
                category: category || '',
                tags: tags || '',
                url: url || '',
                createdAt: new Date().toISOString()
            });
        }

        saveQADatabase(qaDatabase);
        res.json({ success: true, message: 'Data berhasil disimpan' });
    } catch (error) {
        console.error('Error saving QA database:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error menyimpan data: ' + error.message 
        });
    }
});

// Delete QA item
app.delete('/api/qa-database/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let qaDatabase = loadQADatabase();
        
        qaDatabase = qaDatabase.filter(item => item.id !== id);
        
        saveQADatabase(qaDatabase);
        res.json({ success: true, message: 'Data berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting QA database item:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error menghapus data: ' + error.message 
        });
    }
});

// Import QA Database dari Excel
app.post('/api/qa-database/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'File Excel tidak ditemukan' 
            });
        }

        // Baca file Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert ke JSON
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Hapus file upload
        fs.unlinkSync(req.file.path);
        
        if (data.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'File Excel kosong' 
            });
        }

        let qaDatabase = loadQADatabase();
        let imported = 0;
        let updated = 0;
        let errors = [];

        for (const row of data) {
            try {
                // Validasi kolom required
                if (!row.question || !row.answer) {
                    errors.push(`Baris dengan pertanyaan "${row.question || 'kosong'}" tidak memiliki jawaban`);
                    continue;
                }

                const id = row.id ? parseInt(row.id) : null;
                
                if (id) {
                    // Update existing
                    const index = qaDatabase.findIndex(item => item.id === id);
                    if (index >= 0) {
                        qaDatabase[index] = {
                            id,
                            question: row.question,
                            answer: row.answer,
                            ustadz: row.ustadz || '',
                            category: row.category || '',
                            tags: row.tags || '',
                            url: row.url || '',
                            updatedAt: new Date().toISOString()
                        };
                        updated++;
                    } else {
                        // ID not found, add as new
                        qaDatabase.push({
                            id,
                            question: row.question,
                            answer: row.answer,
                            ustadz: row.ustadz || '',
                            category: row.category || '',
                            tags: row.tags || '',
                            url: row.url || '',
                            createdAt: new Date().toISOString()
                        });
                        imported++;
                    }
                } else {
                    // Add new with auto-increment ID
                    const newId = qaDatabase.length > 0 
                        ? Math.max(...qaDatabase.map(item => item.id || 0)) + 1 
                        : 1;
                    
                    qaDatabase.push({
                        id: newId,
                        question: row.question,
                        answer: row.answer,
                        ustadz: row.ustadz || '',
                        category: row.category || '',
                        tags: row.tags || '',
                        url: row.url || '',
                        createdAt: new Date().toISOString()
                    });
                    imported++;
                }
            } catch (rowError) {
                errors.push(`Error pada baris: ${rowError.message}`);
            }
        }

        saveQADatabase(qaDatabase);
        
        res.json({ 
            success: true, 
            message: `Import berhasil! ${imported} data baru, ${updated} data diupdate.`,
            stats: { imported, updated, errors: errors.length > 0 ? errors : undefined }
        });
    } catch (error) {
        console.error('Error importing QA database:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error mengimport Excel: ' + error.message 
        });
    }
});

// Update config
app.post('/api/config', (req, res) => {
    try {
        saveConfig(req.body);
        res.json({ success: true, message: 'Konfigurasi berhasil disimpan' });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ success: false, message: 'Error menyimpan konfigurasi: ' + error.message });
    }
});

// Get contacts
app.get('/api/contacts', (req, res) => {
    const contactsData = loadContacts();
    res.json({ contacts: contactsData.contacts || [] });
});

// Toggle auto reply for contact
app.post('/api/contacts/:number/auto-reply', (req, res) => {
    const { number } = req.params;
    const { autoReply } = req.body;

    const contactsData = loadContacts();
    const contact = contactsData.contacts.find(c => c.number === number);

    if (!contact) {
        return res.json({ success: false, message: 'Kontak tidak ditemukan' });
    }

    contact.autoReply = autoReply;
    saveContacts(contactsData);

    res.json({ 
        success: true, 
        message: `Mode balasan untuk ${contact.name || number} diubah ke ${autoReply ? 'otomatis' : 'manual'}` 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Admin Dashboard berjalan di http://localhost:${PORT}`);
});
