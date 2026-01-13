// API Base URL
const API_URL = 'http://localhost:3000/api';

// Switch tabs
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    // Load data for specific tabs
    if (tab === 'knowledge') {
        loadKeywords();
    } else if (tab === 'config') {
        loadConfig();
    } else if (tab === 'contacts') {
        loadContacts();
    } else if (tab === 'qa-database') {
        loadQADatabase();
    }
}

// Check bot status
async function checkBotStatus() {
    try {
        const response = await fetch(`${API_URL}/bot/status`);
        const data = await response.json();
        
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const startBtn = document.getElementById('startBotBtn');
        const stopBtn = document.getElementById('stopBotBtn');
        const qrSection = document.getElementById('qrSection');
        const readySection = document.getElementById('readySection');
        
        if (data.isReady) {
            indicator.classList.add('ready');
            statusText.textContent = 'Bot Online & Siap';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            qrSection.style.display = 'none';
            readySection.style.display = 'block';
        } else if (data.isCleaning) {
            indicator.classList.remove('ready');
            statusText.textContent = '🧹 Membersihkan Session... (tunggu 30 detik)';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            qrSection.style.display = 'none';
            readySection.style.display = 'none';
        } else if (data.isInitializing) {
            indicator.classList.remove('ready');
            statusText.textContent = '⏳ Menginisialisasi Bot... (tunggu beberapa detik)';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            qrSection.style.display = 'none';
            readySection.style.display = 'none';
        } else if (data.hasQRCode) {
            indicator.classList.remove('ready');
            statusText.textContent = 'Menunggu Scan QR Code';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            qrSection.style.display = 'block';
            readySection.style.display = 'none';
            loadQRCode();
        } else {
            indicator.classList.remove('ready');
            statusText.textContent = 'Bot Offline';
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            qrSection.style.display = 'none';
            readySection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

// Load QR Code
async function loadQRCode() {
    try {
        console.log('📱 Loading QR Code...');
        const response = await fetch(`${API_URL}/bot/qr`);
        const data = await response.json();
        
        console.log('QR Data:', data);
        
        if (data.qr) {
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            
            // Generate QR code using a library or show as image
            const qrImage = document.createElement('img');
            qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qr)}`;
            qrImage.style.width = '300px';
            qrImage.style.height = '300px';
            qrImage.onerror = () => {
                console.error('❌ Failed to load QR image');
                qrContainer.innerHTML = '<p style="color:red;">Error loading QR code image</p>';
            };
            qrImage.onload = () => {
                console.log('✅ QR Code image loaded successfully');
            };
            qrContainer.appendChild(qrImage);
        } else {
            console.warn('⚠️ No QR code data received');
        }
    } catch (error) {
        console.error('Error loading QR:', error);
    }
}

// Start bot
document.getElementById('startBotBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_URL}/bot/start`, {
            method: 'POST'
        });
        const data = await response.json();
        alert(data.message);
        checkBotStatus();
        
        // Check status every 2 seconds when waiting for QR
        const interval = setInterval(() => {
            checkBotStatus();
        }, 2000);
        
        // Stop checking after 2 minutes
        setTimeout(() => clearInterval(interval), 120000);
    } catch (error) {
        alert('Error starting bot: ' + error.message);
    }
});

// Stop bot
document.getElementById('stopBotBtn').addEventListener('click', async () => {
    if (!confirm('Yakin ingin menghentikan bot?')) return;
    
    try {
        const response = await fetch(`${API_URL}/bot/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        alert(data.message);
        checkBotStatus();
    } catch (error) {
        alert('Error stopping bot: ' + error.message);
    }
});

// Load keywords
async function loadKeywords() {
    try {
        const response = await fetch(`${API_URL}/knowledge/keywords`);
        const data = await response.json();
        
        const container = document.getElementById('keywordItems');
        container.innerHTML = '';
        
        if (data.keywords.length === 0) {
            container.innerHTML = '<p style="color: #666;">Belum ada keyword. Tambahkan keyword pertama Anda!</p>';
            return;
        }
        
        data.keywords.forEach(keyword => {
            const response = data.responses[keyword];
            const item = document.createElement('div');
            item.className = 'keyword-item';
            
            // Escape keyword untuk digunakan di HTML
            const escapedKeyword = keyword.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedResponse = response.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            item.innerHTML = `
                <div class="keyword-info">
                    <strong>${keyword}</strong>
                    <div style="color: #666; white-space: pre-wrap;">${escapedResponse}</div>
                </div>
                <div class="keyword-actions">
                    <button class="btn btn-secondary" onclick="editKeyword('${escapedKeyword}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteKeyword('${escapedKeyword}')">Hapus</button>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading keywords:', error);
    }
}

// Save keyword
async function saveKeyword() {
    const keyword = document.getElementById('keyword').value.trim().toLowerCase();
    const response = document.getElementById('response').value.trim();
    
    if (!keyword || !response) {
        alert('Keyword dan respons harus diisi!');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/knowledge/keyword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, response })
        });
        
        if (!res.ok) {
            throw new Error('Server error: ' + res.status);
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error('Server tidak mengembalikan JSON. Response: ' + text.substring(0, 100));
        }
        
        const data = await res.json();
        alert(data.message);
        
        if (data.success) {
            document.getElementById('keyword').value = '';
            document.getElementById('response').value = '';
            loadKeywords();
        }
    } catch (error) {
        console.error('Error details:', error);
        alert('Error saving keyword: ' + error.message);
    }
}

// Edit keyword
async function editKeyword(keyword) {
    try {
        const response = await fetch(`${API_URL}/knowledge/keywords`);
        
        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }
        
        const data = await response.json();
        
        if (data.responses && data.responses[keyword]) {
            document.getElementById('keyword').value = keyword;
            document.getElementById('response').value = data.responses[keyword];
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error('Keyword tidak ditemukan');
        }
    } catch (error) {
        console.error('Error loading keyword:', error);
        alert('Error loading keyword: ' + error.message);
    }
}

// Delete keyword
async function deleteKeyword(keyword) {
    if (!confirm(`Yakin ingin menghapus keyword "${keyword}"?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/knowledge/keyword/${encodeURIComponent(keyword)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error('Server tidak mengembalikan JSON');
        }
        
        const data = await response.json();
        alert(data.message);
        
        if (data.success) {
            loadKeywords();
        }
    } catch (error) {
        console.error('Error deleting keyword:', error);
        alert('Error deleting keyword: ' + error.message);
    }
}

// Load config
async function loadConfig() {
    try {
        const response = await fetch(`${API_URL}/config`);
        const data = await response.json();
        
        document.getElementById('companyName').value = data.companyName;
        document.getElementById('business').value = data.business;
        document.getElementById('phone').value = data.phone;
        document.getElementById('email').value = data.email;
        document.getElementById('address').value = data.address;
        document.getElementById('operationalHours').value = data.operationalHours;
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Save config
async function saveConfig() {
    const config = {
        companyName: document.getElementById('companyName').value,
        business: document.getElementById('business').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        operationalHours: document.getElementById('operationalHours').value
    };
    
    try {
        const response = await fetch(`${API_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Error saving config: ' + error.message);
    }
}

// Load contacts
async function loadContacts() {
    try {
        const response = await fetch(`${API_URL}/contacts`);
        const data = await response.json();
        
        const container = document.getElementById('contactItems');
        container.innerHTML = '';
        
        if (data.contacts.length === 0) {
            container.innerHTML = '<p style="color: #666;">Belum ada chat masuk.</p>';
            return;
        }
        
        data.contacts.forEach(contact => {
            const item = document.createElement('div');
            item.className = 'contact-item';
            item.innerHTML = `
                <div class="contact-info">
                    <div class="contact-name">${contact.name || contact.number}</div>
                    <div class="contact-number">${contact.number}</div>
                    <div class="contact-last-msg">${contact.lastMessage || 'Belum ada pesan'}</div>
                </div>
                <div class="contact-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${contact.autoReply ? 'checked' : ''} 
                               onchange="toggleAutoReply('${contact.number}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">${contact.autoReply ? 'Otomatis' : 'Manual'}</span>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

// Toggle auto reply for contact
async function toggleAutoReply(number, autoReply) {
    try {
        const response = await fetch(`${API_URL}/contacts/${encodeURIComponent(number)}/auto-reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoReply })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const status = autoReply ? 'otomatis' : 'manual';
            showNotification(`Mode balasan untuk ${number} diubah ke ${status}`);
            loadContacts();
        }
    } catch (error) {
        alert('Error mengubah mode: ' + error.message);
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Import Excel
async function importExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Silakan pilih file Excel terlebih dahulu');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/knowledge/import-excel`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message);
            if (data.stats.errors) {
                console.warn('Import warnings:', data.stats.errors);
            }
            loadKeywords();
            fileInput.value = ''; // Clear file input
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error mengimport file: ' + error.message);
    }
}

// Download template Excel
function downloadTemplate() {
    const template = `keyword,response
halo,Halo! Selamat datang di {companyName}. Ada yang bisa kami bantu?
info,Untuk informasi lebih lanjut silakan hubungi {phone} atau email ke {email}
alamat,Alamat kami: {address}`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_keywords.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Template CSV berhasil didownload!');
}

// ===== QA DATABASE FUNCTIONS =====

let qaDataCache = [];

// Load QA Database
async function loadQADatabase() {
    try {
        const response = await fetch(`${API_URL}/qa-database`);
        const result = await response.json();
        qaDataCache = result.data || [];
        displayQAData(qaDataCache);
    } catch (error) {
        console.error('Error loading QA database:', error);
        showNotification('Error memuat QA database', 'error');
    }
}

// Display QA Data
function displayQAData(data) {
    const container = document.getElementById('qaDataList');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Belum ada data. Silakan tambah data Q&A dari ustad.</p>';
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="card" style="margin-bottom: 15px; border-left: 4px solid #25D366;">
            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <span style="background: #e3f2fd; padding: 3px 8px; border-radius: 3px; font-size: 12px; color: #1976d2;">ID: ${item.id}</span>
                    ${item.category ? `<span style="background: #fff3e0; padding: 3px 8px; border-radius: 3px; font-size: 12px; color: #f57c00; margin-left: 5px;">${item.category}</span>` : ''}
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="editQAData(${item.id})" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✏️ Edit</button>
                    <button onclick="deleteQAData(${item.id})" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">🗑️ Hapus</button>
                </div>
            </div>
            
            <h4 style="color: #333; margin-bottom: 8px;">❓ ${item.question}</h4>
            <p style="color: #666; margin-bottom: 10px; line-height: 1.6;">${item.answer}</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 13px; color: #777;">
                ${item.ustadz ? `<span>👨‍🏫 <strong>${item.ustadz}</strong></span>` : ''}
                ${item.tags ? `<span>🏷️ ${item.tags}</span>` : ''}
                ${item.url ? `<span>🔗 <a href="${item.url}" target="_blank" style="color: #2196F3;">Link</a></span>` : ''}
            </div>
        </div>
    `).join('');
}

// Filter QA Data
function filterQAData() {
    const searchTerm = document.getElementById('qaSearchInput').value.toLowerCase();
    const filtered = qaDataCache.filter(item => 
        item.question.toLowerCase().includes(searchTerm) ||
        item.answer.toLowerCase().includes(searchTerm) ||
        (item.tags && item.tags.toLowerCase().includes(searchTerm)) ||
        (item.category && item.category.toLowerCase().includes(searchTerm))
    );
    displayQAData(filtered);
}

// Clear QA Form
function clearQAForm() {
    document.getElementById('qaId').value = '';
    document.getElementById('qaQuestion').value = '';
    document.getElementById('qaAnswer').value = '';
    document.getElementById('qaUstadz').value = '';
    document.getElementById('qaCategory').value = '';
    document.getElementById('qaTags').value = '';
    document.getElementById('qaUrl').value = '';
}

// Save QA Data
async function saveQAData() {
    const id = document.getElementById('qaId').value;
    const question = document.getElementById('qaQuestion').value.trim();
    const answer = document.getElementById('qaAnswer').value.trim();
    const ustadz = document.getElementById('qaUstadz').value.trim();
    const category = document.getElementById('qaCategory').value.trim();
    const tags = document.getElementById('qaTags').value.trim();
    const url = document.getElementById('qaUrl').value.trim();

    if (!question || !answer) {
        showNotification('Pertanyaan dan jawaban harus diisi!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/qa-database`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id ? parseInt(id) : null,
                question,
                answer,
                ustadz,
                category,
                tags,
                url
            })
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message);
            clearQAForm();
            loadQADatabase();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving QA data:', error);
        showNotification('Error menyimpan data', 'error');
    }
}

// Edit QA Data
function editQAData(id) {
    const item = qaDataCache.find(qa => qa.id === id);
    if (!item) return;

    document.getElementById('qaId').value = item.id;
    document.getElementById('qaQuestion').value = item.question;
    document.getElementById('qaAnswer').value = item.answer;
    document.getElementById('qaUstadz').value = item.ustadz || '';
    document.getElementById('qaCategory').value = item.category || '';
    document.getElementById('qaTags').value = item.tags || '';
    document.getElementById('qaUrl').value = item.url || '';

    // Scroll to form
    document.getElementById('qa-database-tab').scrollIntoView({ behavior: 'smooth' });
    showNotification('Data dimuat ke form. Silakan edit dan simpan.');
}

// Delete QA Data
async function deleteQAData(id) {
    if (!confirm('Yakin ingin menghapus data ini?')) return;

    try {
        const response = await fetch(`${API_URL}/qa-database/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message);
            loadQADatabase();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting QA data:', error);
        showNotification('Error menghapus data', 'error');
    }
}

// Import QA Database from Excel
async function importQAExcel() {
    const fileInput = document.getElementById('qaExcelFile');
    const file = fileInput.files[0];

    if (!file) {
        showNotification('Pilih file Excel terlebih dahulu!', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showNotification('Mengimport data...');
        
        const response = await fetch(`${API_URL}/qa-database/import`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification(`${result.message}\nImported: ${result.stats.imported}, Updated: ${result.stats.updated}`);
            fileInput.value = '';
            loadQADatabase();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error importing Excel:', error);
        showNotification('Error mengimport Excel: ' + error.message, 'error');
    }
}

// Initialize
checkBotStatus();
setInterval(checkBotStatus, 5000);
// Auto refresh contacts tab if active
setInterval(() => {
    const contactTab = document.getElementById('contacts-tab');
    if (contactTab && contactTab.classList.contains('active')) {
        loadContacts();
    }
}, 5000);
