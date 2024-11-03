require('dotenv').config();
const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI(process.env.PASTEBIN_API_KEY);
const { makeid } = require('./id');
const id = makeid();
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, DisconnectReason, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const mongoose = require("mongoose");

let phoneNumber = process.env.PHONE_NUMBER || "923253617422";
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Set up mongoose to use as a database for session data
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const SessionSchema = new mongoose.Schema({ id: String, data: Object });
const Session = mongoose.model('Session', SessionSchema);

async function saveSessionData(id, data) {
  await Session.findOneAndUpdate({ id }, { data }, { upsert: true });
}

async function loadSessionData(id) {
  const session = await Session.findOne({ id });
  return session ? session.data : null;
}

async function qr() {
  let { version, isLatest } = await fetchLatestBaileysVersion();
  const state = await loadSessionData(id) || await useMultiFileAuthState('./session/'+id);
  const msgRetryCounterCache = new NodeCache();

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !pairingCode,
    browser: Browsers.macOS('safari'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  });

  if (pairingCode && !sock.authState.creds.registered) {
    if (useMobile) throw new Error('Cannot use pairing code with mobile api');
    
    if (phoneNumber) {
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example : +923253617422")));
        process.exit(0);
      }
    } else {
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright("Please type your WhatsApp number 😍\nFor example: +923253617422 : ")));
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      rl.close();
    }

    setTimeout(async () => {
      let code = await sock.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(chalk.black(chalk.bgGreen("Your Pairing Code: ")), chalk.black(chalk.white(code)));
    }, 3000);
  }

  sock.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection === "open") {
      await delay(1000 * 10);
      const output = await pastebin.createPasteFromFile(__dirname + `/session/${id}/creds.json`, "pastebin-js test", null, 1, "N");
      const ethix = await sock.sendMessage(sock.user.id, {
        text: `Sarkarmd$` + output.split('/')[3]
      });
      await sock.sendMessage(sock.user.id, { text: `> *_Pair Code Connected With SARKAR_MD*
          *_Made With 🤍_*
          ═══════════════════
          Visit For Help:
          *YouTube:* youtube.com/@sarkarjiteach
          *Owner:* https://wa.me/923253617422
          *Repo:* https://github.com/sarKarji1/SARKAR_MD
          *WaGroup:* https://chat.whatsapp.com/IZ08OuI8pqV2RbTrDvlQk3
          ═══════════════════
          ❌ DO NOT SHARE THIS SESSION-ID WITH ANYBODY` }, { quoted: ethix });
      await delay(1000 * 2);
      process.exit(0);
    }
    if (connection === "close" && lastDisconnect?.error?.output.statusCode !== 401) {
      qr();
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveSessionData(id, state);
  });

  sock.ev.on("messages.upsert", () => {});
}
qr();

process.on('uncaughtException', function (err) {
  let e = String(err);
  if (!["conflict", "not-authorized", "Socket connection timeout", "rate-overlimit", "Connection Closed", "Timed Out", "Value not found"].some(error => e.includes(error))) {
    console.log('Caught exception: ', err);
  }
});
