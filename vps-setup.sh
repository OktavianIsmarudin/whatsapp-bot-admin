#!/bin/bash

echo "=================================================="
echo "  WhatsApp Bot Admin - VPS Setup Script"
echo "  Hostinger VPS Ubuntu Installation"
echo "=================================================="
echo ""

# Update system
echo "📦 Step 1/7: Updating system..."
apt update && apt upgrade -y

# Install Node.js
echo "📦 Step 2/7: Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node.js installation
echo "✅ Node.js version:"
node -v
echo "✅ NPM version:"
npm -v

# Install dependencies for WhatsApp Web.js
echo "📦 Step 3/7: Installing Chromium and dependencies..."
apt install -y chromium-browser chromium-codecs-ffmpeg git wget unzip

# Install additional libraries for Puppeteer
apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 \
lsb-release xdg-utils

# Clone repository
echo "📦 Step 4/7: Cloning WhatsApp Bot repository..."
cd /root
if [ -d "whatsapp-bot-admin" ]; then
    echo "⚠️  Directory exists, pulling latest changes..."
    cd whatsapp-bot-admin
    git pull
else
    git clone https://github.com/OktavianIsmarudin/whatsapp-bot-admin.git
    cd whatsapp-bot-admin
fi

# Install npm dependencies
echo "📦 Step 5/7: Installing npm dependencies..."
npm install

# Create .env file
echo "📦 Step 6/7: Creating .env file..."
echo "⚠️  IMPORTANT: You need to add your GROQ_API_KEY manually!"
cat > .env << EOF
PORT=3000
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
NODE_ENV=production
EOF

echo "✅ .env file created"
echo "⚠️  EDIT .env file and add your GROQ_API_KEY:"
echo "   nano .env"

# Install PM2
echo "📦 Step 7/7: Installing PM2 process manager..."
npm install -g pm2

# Setup firewall
echo "🔥 Setting up firewall..."
ufw allow 3000
ufw allow OpenSSH
echo "y" | ufw enable

# Start application with PM2
echo "🚀 Starting WhatsApp Bot..."
pm2 stop whatsapp-bot 2>/dev/null
pm2 delete whatsapp-bot 2>/dev/null
pm2 start server.js --name whatsapp-bot
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "=================================================="
echo "  ✅ INSTALLATION COMPLETE!"
echo "=================================================="
echo ""
echo "📊 Bot Status:"
pm2 status
echo ""
echo "🌐 Access your dashboard at:"
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo "📝 Useful Commands:"
echo "   pm2 status              - Check bot status"
echo "   pm2 logs whatsapp-bot   - View logs"
echo "   pm2 restart whatsapp-bot - Restart bot"
echo "   pm2 stop whatsapp-bot   - Stop bot"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Open http://YOUR_VPS_IP:3000 in browser"
echo "   2. Click 'Start Bot'"
echo "   3. Scan QR code with WhatsApp"
echo ""
echo "=================================================="
