import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import Pino from "pino";

const logger = Pino({ level: "silent" });

// ===== SETTINGS =====
const SETTINGS = {
  owner: "2348125526712@s.whatsapp.net",
  prefix: ".",
  admins: [],  // add admin numbers here
  banned: [],
};

// ===== UTILITY FUNCTIONS =====
const isOwner = (jid) => jid === SETTINGS.owner;
const isAdmin = (jid) => SETTINGS.admins.includes(jid) || isOwner(jid);
const isBanned = (jid) => SETTINGS.banned.includes(jid);

// ===== COMMAND HANDLER =====
function handleCommand(sock, from, text) {
  const args = text.trim().split(" ");
  const command = args.shift().toLowerCase();

  if (isBanned(from)) {
    sock.sendMessage(from, { text: "🚫 You are banned from interacting with DarkNexus." });
    return;
  }

  let reply = "DarkNexus ⚡ received your message.";

  // Fun commands
  if (command === "hi" || command === "hello") reply = "DarkNexus ⚡ active and listening.";
  else if (command === "help") reply = "Commands:\n.hi\n.help\n.ping\n.info\n.darkmode\n.shadow\n.echo\n.owner\n.block\n.unblock\n.ban\n.unban";
  else if (command === "ping") reply = "🏓 Pong! DarkNexus is online.";
  else if (command === "info") reply = "DarkNexus WhatsApp Bot ⚡ v1.0 – Fully automated";
  else if (command === "darkmode") reply = "🌑 Activating Dark Mode... ⚡ Welcome to the shadows!";
  else if (command === "shadow") reply = "🕶️ You are now in the shadows!";
  else if (command === "echo") reply = args.join(" ") ? `📣 Echo: ${args.join(" ")}` : "📣 Nothing to echo!";
  else if (command === "owner") reply = "👑 The owner of DarkNexus is the legendary master of shadows!";

  // Admin/Owner commands
  else if (command === "block") {
    if (!isAdmin(from)) reply = "❌ Only admins can use this command.";
    else if (!args[0]) reply = "⚠️ Usage: .block <jid>";
    else {
      sock.updateBlockStatus(args[0], "block");
      reply = `🚫 User ${args[0]} has been blocked.`;
    }
  }
  else if (command === "unblock") {
    if (!isAdmin(from)) reply = "❌ Only admins can use this command.";
    else if (!args[0]) reply = "⚠️ Usage: .unblock <jid>";
    else {
      sock.updateBlockStatus(args[0], "unblock");
      reply = `✅ User ${args[0]} has been unblocked.`;
    }
  }
  else if (command === "ban") {
    if (!isAdmin(from)) reply = "❌ Only admins can use this command.";
    else if (!args[0]) reply = "⚠️ Usage: .ban <jid>";
    else {
      if (!SETTINGS.banned.includes(args[0])) SETTINGS.banned.push(args[0]);
      reply = `🚫 User ${args[0]} has been banned from the bot.`;
    }
  }
  else if (command === "unban") {
    if (!isAdmin(from)) reply = "❌ Only admins can use this command.";
    else if (!args[0]) reply = "⚠️ Usage: .unban <jid>";
    else {
      SETTINGS.banned = SETTINGS.banned.filter(jid => jid !== args[0]);
      reply = `✅ User ${args[0]} has been unbanned.`;
    }
  }

  sock.sendMessage(from, { text: reply });
}

// ===== START BOT =====
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot connected successfully!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    console.log(`💬 Message from ${from}: ${text}`);

    // Auto view status
    if (msg.key.remoteJid === "status@broadcast") {
      await sock.sendReadReceipt(msg.key.remoteJid, msg.key.participant, [msg.key.id]);
    }

    // Anti delete
    if (msg.message?.protocolMessage?.type === 0) {
      const deletedMsg = msg.message.protocolMessage;
      await sock.sendMessage(from, { text: `🚨 User tried to delete a message! Original message: ${deletedMsg.key.id || "Unknown"}` });
    }

    // Auto react
    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

    // Auto typing
    await sock.sendPresenceUpdate("composing", from);
    await new Promise(r => setTimeout(r, 1500));

    // Handle commands
    if (text.startsWith(SETTINGS.prefix)) handleCommand(sock, from, text.slice(SETTINGS.prefix.length));
    else sock.sendMessage(from, { text: "DarkNexus ⚡ received your message." });
  });
}

startBot();
