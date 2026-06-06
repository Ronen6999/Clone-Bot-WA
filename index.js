const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');
const { askGroq } = require('./groqPrompt');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const sessionRoot = path.join(__dirname, 'sessions');
const sessionName = process.env.SESSION_NAME || 'default';
const authPath = path.join(sessionRoot, sessionName);
const ownerJid = process.env.OWNER_JID || null;

// Probability to send a sticker after replying (0.0 - 1.0). Default ~35%.
const STICKER_PROB = Math.min(1, Math.max(0, parseFloat(process.env.STICKER_PROB || '0.20')));

if (!fs.existsSync(sessionRoot)) {
  fs.mkdirSync(sessionRoot, { recursive: true });
}

let state;
let saveCreds;
let botJid;
let botStartTime = Date.now();
let lastResponseTime = 0;
const historyFile = path.join(sessionRoot, 'chatHistory.json');
const MAX_USER_HISTORY_MESSAGES = 7;
const MAX_CONTEXT_MESSAGES = 8;
let chatHistory = {};

const botState = {
  enabled: true,
};

function getSystemStats() {
  const uptime = Math.floor((Date.now() - botStartTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryPercent = ((usedMemory / totalMemory) * 100).toFixed(1);

  const cpus = os.cpus();
  const cpuCount = cpus.length;
  const cpuModel = cpus[0]?.model || 'Unknown';

  const processMemory = process.memoryUsage();
  const heapUsed = (processMemory.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotal = (processMemory.heapTotal / 1024 / 1024).toFixed(2);

  return {
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    responseSpeed: `${lastResponseTime}ms`,
    ramUsage: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)}GB / ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB (${memoryPercent}%)`,
    cpuInfo: `${cpuCount} cores - ${cpuModel}`,
    heapUsage: `${heapUsed}MB / ${heapTotal}MB`,
  };
}

function getCommandSender(key) {
  return key.participant || key.remoteJid;
}

function isAuthorizedCommand(key) {
  if (key.fromMe) return true;
  const sender = getCommandSender(key);
  return sender === botJid || sender === ownerJid;
}

function getHistoryKey(msg) {
  const id = msg.key.participant || msg.key.remoteJid || '';
  const lidMatch = id.match(/([^@]+@lid)$/);
  return lidMatch ? lidMatch[1] : id;
}

function loadChatHistory() {
  try {
    if (!fs.existsSync(historyFile)) return {};
    const raw = fs.readFileSync(historyFile, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load chat history:', e);
    return {};
  }
}

function saveChatHistory() {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(chatHistory, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
}

function pruneHistoryByUserMessages(key) {
  if (!key || !chatHistory[key] || chatHistory[key].length === 0) return;
  const history = chatHistory[key];
  let userCount = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === 'user') {
      userCount += 1;
      if (userCount === MAX_USER_HISTORY_MESSAGES) {
        chatHistory[key] = history.slice(i);
        return;
      }
    }
  }
}

function appendHistoryEntry(key, role, text) {
  if (!key || !text) return;
  if (!chatHistory[key]) chatHistory[key] = [];
  chatHistory[key].push({ role, text, timestamp: Date.now() });
  pruneHistoryByUserMessages(key);
}

function getContextMessages(key) {
  if (!key || !chatHistory[key]) return [];
  const history = chatHistory[key].slice(-MAX_CONTEXT_MESSAGES);
  return history.map((entry) => ({ role: entry.role, content: entry.text }));
}

chatHistory = loadChatHistory();

async function getApiReply(text) {
  // Placeholder for future API integration.
  // Replace this with your async call to an external API.
  return `Bot reply placeholder: received "${text}"`;
}

function getTextFromMessage(message) {
  if (!message) return '';
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.singleSelectReply?.selectedDisplayText) return message.listResponseMessage.singleSelectReply.selectedDisplayText;
  return '';
}

function getQuotedTextFromMessage(message) {
  if (!message) return '';
  const contextInfo = message.extendedTextMessage?.contextInfo
    || message.imageMessage?.contextInfo
    || message.videoMessage?.contextInfo
    || message.buttonsResponseMessage?.contextInfo
    || message.listResponseMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return '';
  const quotedText = getTextFromMessage(quoted);
  if (quotedText) return quotedText;
  return '[quoted message could not be extracted]';
}

function detectMood(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  const happyWords = ['lol', 'haha', 'lmao', 'yaay', 'yay', 'good', 'great', 'happy', 'joy', '😂', '😄', '😁', ':)'];
  const sadWords = ['sad', 'unhappy', 'depressed', '😢', '😭', ':' , 'miss'];
  const angryWords = ['angry', 'mad', 'furious', 'wtf', 'bruh', 'shesh', '😡', '😤'];

  for (const w of happyWords) if (t.includes(w)) return 'happy';
  for (const w of sadWords) if (t.includes(w)) return 'sad';
  for (const w of angryWords) if (t.includes(w)) return 'angry';
  return 'neutral';
}

async function sendStickerIfAvailable(sock, remoteJid, mood, quoted) {
  try {
    // First check for a folder of stickers for this mood: `stickers/<mood>/* .webp`
    const moodDir = path.join(__dirname, 'stickers', mood);
    if (fs.existsSync(moodDir)) {
      const stat = await fs.promises.stat(moodDir);
      if (stat.isDirectory()) {
        const files = (await fs.promises.readdir(moodDir)).filter(f => f.toLowerCase().endsWith('.webp'));
        if (files.length > 0) {
          const choice = files[Math.floor(Math.random() * files.length)];
          const buff = await fs.promises.readFile(path.join(moodDir, choice));
          await sock.sendMessage(remoteJid, { sticker: buff }, { quoted });
          return true;
        }
      }
    }

    // Fallback to single-file sticker `stickers/<mood>.webp`
    const stickerPath = path.join(__dirname, 'stickers', `${mood}.webp`);
    if (!fs.existsSync(stickerPath)) return false;
    const buff = await fs.promises.readFile(stickerPath);
    await sock.sendMessage(remoteJid, { sticker: buff }, { quoted });
    return true;
  } catch (e) {
    console.error('Failed to send sticker:', e);
    return false;
  }
}

function isCommand(text) {
  return text.startsWith('/bot ');
}

function isDirectMessage(remoteJid) {
  return remoteJid && !remoteJid.endsWith('@g.us');
}

async function handleCommand(sock, remoteJid, text, quoted) {
  const command = text.trim().toLowerCase();

  if (command === '/bot on') {
    botState.enabled = true;
    await sock.sendMessage(remoteJid, { text: '✅ Bot has been enabled.' }, { quoted });
    return true;
  }

  if (command === '/bot off') {
    botState.enabled = false;
    await sock.sendMessage(remoteJid, { text: '⛔ Bot has been disabled.' }, { quoted });
    return true;
  }

  if (command === '/bot status') {
    const status = botState.enabled ? 'enabled' : 'disabled';
    const stats = getSystemStats();
    const statusMsg = `ℹ️ *Bot Status:*

• *Status:* _${status}_
• *Uptime:* _${stats.uptime}_
• *Last Response:* _${stats.responseSpeed}_
• *RAM Usage:* _${stats.ramUsage}_
• *CPU:* _${stats.cpuInfo}_
• *Heap:* _${stats.heapUsage}_

> Ronen Bots Private Property`;
    await sock.sendMessage(remoteJid, { text: statusMsg }, { quoted });
    return true;
  }

  return false;
}

async function startBot() {
  ({ state, saveCreds } = await useMultiFileAuthState(authPath));
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('🔑 Pairing QR code: scan it with WhatsApp');
      qrcode.generate(qr, { small: true });
      console.log('If the terminal QR is not readable, use this raw QR string:\n', qr);
    }

    if (connection === 'open') {
      botJid = sock.user?.id || null;
      console.log('✅ Bot connected successfully.');
      console.log(`Session saved under ${authPath}`);
      if (ownerJid) {
        console.log(`Command access restricted to bot number and owner: ${ownerJid}`);
      } else {
        console.log(`Command access restricted to bot number: ${botJid}`);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed:', lastDisconnect?.error?.output?.payload || lastDisconnect?.error?.message);
      if (shouldReconnect) {
        console.log('Reconnecting...');
        startBot();
      } else {
        console.log('Logged out. Remove the session folder and restart the bot.');
      }
    }
  });

  sock.ev.on('messages.upsert', async (messageUpdate) => {
    try {
      if (messageUpdate.type !== 'notify') return;
      const msg = messageUpdate.messages[0];
      if (!msg.message) return;

      const remoteJid = msg.key.remoteJid;
      const text = getTextFromMessage(msg.message).trim();
      if (!text) return;

      if (!isDirectMessage(remoteJid)) return;

      if (isCommand(text)) {
        if (isAuthorizedCommand(msg.key)) {
          await handleCommand(sock, remoteJid, text, msg);
        }
        return;
      }

      if (msg.key.fromMe) return;
      if (!botState.enabled) {
        return;
      }

      const historyKey = getHistoryKey(msg);
      const quotedText = getQuotedTextFromMessage(msg.message);
      const contextMessages = getContextMessages(historyKey);

      let reply;
      appendHistoryEntry(historyKey, 'user', text);
      saveChatHistory();
      // Send typing/presence updates while preparing the reply
      let typingInterval;
      try {
        try {
          await sock.sendPresenceUpdate('composing', remoteJid);
        } catch (e) {
          // ignore presence errors
        }

        // keep sending composing every 6s to keep the typing indicator alive
        typingInterval = setInterval(() => {
          try {
            sock.sendPresenceUpdate('composing', remoteJid).catch(() => {});
          } catch (e) {}
        }, 6000);

        const startTime = Date.now();
        reply = await askGroq(text, contextMessages, quotedText);
        lastResponseTime = Date.now() - startTime;
      } catch (err) {
        console.error('Groq error:', err);
        const safeMessage = err && err.message ? err.message : String(err);
        const userMsg = `Groq API error: ${safeMessage}`;
        try {
          await sock.sendPresenceUpdate('paused', remoteJid);
        } catch (e) {}
        await sock.sendMessage(remoteJid, { text: userMsg }, { quoted: msg });
        return;
      } finally {
        if (typingInterval) clearInterval(typingInterval);
        try {
          await sock.sendPresenceUpdate('paused', remoteJid);
        } catch (e) {}
      }

      // Trim very long replies to avoid message size issues
      if (reply.length > 4000) reply = reply.slice(0, 4000) + '\n\n...[truncated]';

      if (typeof reply !== 'string') reply = String(reply);

      const typingDelayMs = 2000 + Math.floor(Math.random() * 1000);
      try {
        await sock.sendPresenceUpdate('composing', remoteJid);
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, typingDelayMs));

      appendHistoryEntry(historyKey, 'assistant', reply);
      saveChatHistory();

      const shouldQuoteReply = Math.random() < 0.5;
      const sendOptions = shouldQuoteReply ? { quoted: msg } : {};
      await sock.sendMessage(remoteJid, { text: reply }, sendOptions);

      // Try to send a mood-appropriate sticker after replying (randomly based on STICKER_PROB)
      try {
        if (Math.random() < STICKER_PROB) {
          const mood = detectMood(getTextFromMessage(msg.message));
          await sendStickerIfAvailable(sock, remoteJid, mood, msg);
        }
      } catch (e) {
        console.error('Sticker send error:', e);
      }

      try {
        await sock.sendPresenceUpdate('available', remoteJid);
      } catch (e) {}
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });
}

startBot().catch((error) => {
  console.error('Failed to start bot:', error);
});
