const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const fs = require('fs');
const pino = require('pino');
const { 
    default: makeWASocket, 
    Browsers, 
    delay, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");
const { PHONENUMBER_MCC } = require("@whiskeysockets/baileys");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    let id = makeid();
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./session/${id}`);

    const msgRetryCounterCache = new NodeCache();
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        getMessage: async (key) => {
            const jid = jidNormalizedUser(key.remoteJid);
            const msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
    });

    sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            await delay(1000 * 10);
            const output = await pastebin.createPasteFromFile(`./session/${id}/creds.json`, "pastebin-js test", null, 1, "N");
            await sock.sendMessage(sock.user.id, {
                text: `Sarkarmd$` + output.split('/')[3]
            });
            await sock.groupAcceptInvite("IZ08OuI8pqV2RbTrDvlQk3");
            await sock.sendMessage(sock.user.id, { text: `> *_Pair Code Connected With SARKAR_MD*_` }, { quoted: ethix });
            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
            qr();
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on("messages.upsert", () => { });
}

router.get('/', async (req, res) => {
    try {
        await qr();
        res.send("QR code generated successfully. Please check your terminal.");
    } catch (error) {
        console.error("Error occurred: ", error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
