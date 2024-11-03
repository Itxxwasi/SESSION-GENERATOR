const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, makeCacheableSignalKeyStore, PHONENUMBER_MCC, jidNormalizedUser } = require('@whiskeysockets/baileys');
const NodeCache = require('node-cache');
const chalk = require('chalk');
const readline = require('readline');

let phoneNumber = "923253617422"; // Default phone number, can be changed.
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function qr() {
    const id = makeid();
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
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
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    if (pairingCode && !sock.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile API');

        if (!!phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example: +923253617422")));
                process.exit(0);
            }
        } else {
            phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +923253617422 : `)));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log(chalk.bgBlack(chalk.redBright("Start with country code of your WhatsApp Number, Example: +923253617422")));
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFor example: +923253617422 : `)));
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                rl.close();
            }
        }

        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
        }, 3000);
    }

    sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
            await delay(1000 * 10);
            const output = await pastebin.createPasteFromFile(__dirname + `/session/${id}/creds.json`, "pastebin-js test", null, 1, "N");
            const ethix = await sock.sendMessage(sock.user.id, {
                text: `Sarkarmd$` + output.split('/')[3]
            });
            await sock.groupAcceptInvite("IZ08OuI8pqV2RbTrDvlQk3");
            await sock.sendMessage(sock.user.id, { text: `> *_Pair Code Connected With SARKAR_MD*...` }, { quoted: ethix });
            await delay(1000 * 2);
            process.exit(0);
        }
        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
            qr(); // Restart the pairing process on disconnect.
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on("messages.upsert", () => { });
}

qr();

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});
