# WhatsApp Clone Bot 🤖

A WhatsApp bot that mimics a real person's texting style using the Groq API and Baileys library. The bot learns personality traits, responds naturally to messages, and can send mood-appropriate stickers.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366)](https://www.whatsapp.com/)

---

## ✨ Features

- **AI-Powered Responses**: Uses Groq API with advanced language models for natural replies
- **Personality-Based**: Fully customizable bot personality
- **Chat Memory**: Maintains conversation history for context-aware responses
- **Mood Detection**: Detects user mood and sends matching stickers
- **Sticker Support**: Organized sticker packs for different moods (happy, sad, angry, neutral)
- **Command System**: Admin commands to control bot behavior
- **Presence Updates**: Shows typing indicator while generating responses
- **Auto-reconnect**: Automatically reconnects on network failures
- **System Stats**: Built-in status command showing bot health metrics

---

## 📋 Prerequisites

- **Node.js** v16 or higher
- **npm** or yarn
- **Groq API Key** ([Get it for free here](https://console.groq.com))
- **WhatsApp Account** (for QR code scanning)

---

## 🚀 Quick Start

### 1. **Install Dependencies**

```bash
npm install
```

This will install:
- `@whiskeysockets/baileys` - WhatsApp Web automation
- `groq` - Groq API client
- `pino` - Logging utility
- `qrcode-terminal` - QR code generation

### 2. **Configure Environment Variables**

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Then edit `.env` and add your configuration:

```env
# Groq API Configuration (Required)
GROQ_API_KEY=your_groq_api_key_here
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions

# Bot Configuration
BOT_NAME=Ronen              # Name of the bot personality
SESSION_NAME=default        # Session folder name for multiple bots
OWNER_JID=                  # Owner's phone number (optional, for command access)

# Sticker Configuration
STICKER_PROB=0.20          # Probability of sending sticker (0.0 - 1.0)
```

**Getting your Groq API Key:**
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy it to your `.env` file

### 3. **Connect Your WhatsApp Account**

Start the bot:

```bash
npm start
```

**On first run:**
- A QR code will appear in the terminal
- Scan it with your WhatsApp app (Settings → Linked Devices → Link a Device)
- The bot will connect and save the session
- Keep the session secure - don't commit `sessions/` folder to git

### 4. **Send a Test Message**

Open WhatsApp and send a message to the bot number. You should receive a reply in the bot's personality!

---

## 📸 Demo

![Bot Demo](https://i.ibb.co/BKr5Vjhf/Screenshot-2026-06-06-23-18-26-710-com-whatsapp-w4b.jpg)

---

## ⚙️ Configuration Details

| Variable | Purpose | Example |
|----------|---------|----------|
| `GROQ_API_KEY` | Groq API authentication (required) | `gsk_...` |
| `BOT_NAME` | Bot personality name | `Ronen` |
| `SESSION_NAME` | Session folder (for multiple bots) | `default` |
| `OWNER_JID` | Owner phone number (admin commands) | `919876543210@s.whatsapp.net` |
| `STICKER_PROB` | Sticker send probability (0.0-1.0) | `0.20` |

---

## 🎯 Commands

Send these commands in a direct message to control the bot:

### `/bot on`
Enable the bot to respond to messages.

**Response:** ✅ Bot has been enabled.

### `/bot off`
Disable the bot (it will ignore incoming messages).

**Response:** ⛔ Bot has been disabled.

### `/bot status`
Get detailed bot status including uptime, memory usage, and CPU info.

**Response:**
```
ℹ️ Bot Status:

• Status: enabled
• Uptime: 2h 15m 30s
• Last Response: 345ms
• RAM Usage: 1.23GB / 16.00GB (7.7%)
• CPU: 8 cores - Intel Core i7
• Heap: 45.32MB / 102.40MB
```

**Note:** Only the bot owner (configured in `OWNER_JID`) or the account running the bot can use these commands.

---

## 🎨 Setting Up Stickers

Organize sticker files by mood in `stickers/` folder:

```
stickers/
├── happy/       # Happy mood stickers
├── sad/         # Sad mood stickers
├── angry/       # Angry mood stickers
└── neutral/     # Neutral mood stickers
```

Add `.webp` files to these folders. Convert PNG to WebP:
```bash
ffmpeg -i sticker.png sticker.webp
```

---

## 🧠 Customizing Bot Personality

Edit the system prompt in `groqPrompt.js` to define personality traits, communication style, response examples, and keywords. Set `BOT_NAME` in `.env` to control the bot's identity.

---

## 📊 Chat History

Conversation history stored in `sessions/<SESSION_NAME>/chatHistory.json` provides context for more relevant responses. Delete this file to reset conversations.

---

## 🔒 Security & Privacy

⚠️ **Never commit `.env` or `sessions/` folder to git** - Keep API keys secret and bot credentials secure.

---

## ❌ Troubleshooting

### Bot doesn't respond
- Check if bot is enabled: `/bot on`
- Verify `GROQ_API_KEY` is set correctly
- Check internet connection
- Look for error messages in terminal

### QR Code not scanning
- Make sure WhatsApp is up to date
- Try a different device to scan
- Use the raw QR string shown in terminal
- Delete `sessions/default/` and restart

### API Errors
```
Error: Groq API error 401
```
**Solution:** Check your API key in `.env`

```
Error: GROQ_API_KEY environmental variable is required
```
**Solution:** Set `GROQ_API_KEY` in `.env` file

### Stickers not sending
- Ensure sticker files are `.webp` format
- Check folder structure: `stickers/<mood>/`
- Verify `STICKER_PROB > 0` in `.env`
- Check file permissions

### Memory/Performance Issues
- Check system resources: `/bot status`
- Reduce `MAX_CONTEXT_MESSAGES` in `index.js` (default: 8)
- Increase `STICKER_PROB` to 0 to disable stickers

---

## 📁 Project Structure

```
clone-bot-wa/
├── index.js                 # Main bot logic
├── groqPrompt.js           # AI response generation
├── package.json            # Dependencies
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── sessions/              # WhatsApp session data (git-ignored)
├── stickers/              # Sticker packs organized by mood
└── npm-search-groq.json   # API model reference
```

---

## 🔧 Advanced Configuration

**Multiple bots:** Run with different `SESSION_NAME` and `BOT_NAME` variables
**Change AI model:** Edit the `model` field in `groqPrompt.js`
**Adjust context:** Modify `MAX_CONTEXT_MESSAGES` in `index.js`
**See all models:** [Groq Docs](https://console.groq.com/docs/models)

---

## 📝 Deployment

**Keep Running:** Use PM2 to keep the bot alive:
```bash
npm install -g pm2
pm2 start index.js --name "wa-bot"
pm2 startup
```

**Cloud Hosting:** Deploy on Railway, Render, or Fly.io

---

## ⚡ Known Limitations

- WhatsApp may block bot numbers after extended use
- Responses limited to 4000 characters
- Stickers work only in DMs
- Some message types (voice notes, etc.) not supported
- API rate limits depend on your Groq plan

---

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

---

## ⚖️ Disclaimer

**For educational purposes only.** Obtain proper permissions, follow WhatsApp's Terms of Service, and comply with local automation laws. This project is not affiliated with WhatsApp or Groq.

---

**Built with ❤️ using Baileys, Groq API, and Node.js**

![Demo](https://img.shields.io/badge/status-Active-brightgreen) ![Last Updated](https://img.shields.io/badge/updated-2024-blue)
