/** 
 *  Redeveloped by Irull2nd
 *  CopyRight 2024 MIT License
 *  My Github : https://github.com/izumii44
 *  My Channell : https://bit.ly/3VHEPEL
*/

import Function from "./function.js"
import { writeExif } from "./sticker.js"

import fs from "fs"
import util from "util"
import chalk from "chalk"
import Crypto from "crypto"
import { randomBytes } from "crypto"
import { fileURLToPath } from "url"
const {
  default: _makeWaSocket,
  makeWALegacySocket,
  proto,
  downloadContentFromMessage,
  jidDecode,
  areJidsSameUser,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  generateWAMessage,
  WAMessageStubType,
  extractMessageContent,
  jidNormalizedUser,
  MessageType,
  getBinaryNodeChild,
  Mimetype,
} = (await import("@whiskeysockets/baileys")).default;
import baileys from "@whiskeysockets/baileys"
import { parsePhoneNumber } from "libphonenumber-js"

export function Client({ conn, store }) {
    delete store.groupMetadata

    for (let v in store) {
        conn[v] = store[v]
    }

    const client = Object.defineProperties(conn, {
        logger: {
            get() {
                return {
                    info(...args) {
                        console.log(chalk.bold.bgRgb(51, 204, 51)("INFO "), chalk.cyan(util.format(...args)))
                    },
                    error(...args) {
                        console.log(chalk.bold.bgRgb(247, 38, 33)("ERROR "), chalk.rgb(255, 38, 0)(util.format(...args)))
                    },
                    warn(...args) {
                        console.log(chalk.bold.bgRgb(255, 153, 0)("WARNING "), chalk.redBright(util.format(...args)))
                    },
                    trace(...args) {
                        console.log(chalk.grey("TRACE "), chalk.white(util.format(...args)))
                    },
                    debug(...args) {
                        console.log(chalk.bold.bgRgb(66, 167, 245)("DEBUG "), chalk.white(util.format(...args)))
                    }
                }
            },
            enumerable: true
        },

        getContentType: {
            value(content) {
                if (content) {
                    const keys = Object.keys(content)
                    const key = keys.find(k => (k === "conversation" || k.endsWith("Message") || k.endsWith("V2") || k.endsWith("V3")) && k !== "senderKeyDistributionMessage")
                    return key
                }
            },
            enumerable: true
        },

        decodeJid: {
            value(jid) {
                if (/:\d+@/gi.test(jid)) {
                    const decode = baileys.jidNormalizedUser(jid)
                    return decode
                } else return jid
            }
        },

        generateMessageID: {
            value(id = "3EB0", length = 18) {
                return id + Crypto.randomBytes(length).toString("hex").toUpperCase()
            }
        },

    getName: {
      value(jid) {
        let id = conn.decodeJid(jid),
          v;

        if (id?.endsWith("@g.us")) {
          return new Promise(async (resolve) => {
            v =
              conn.contacts[id] ||
              conn.messages["status@broadcast"]?.array?.find(
                (a) => a?.key?.participant === id,
              );
            if (!(v.name || v.subject)) v = conn.groupMetadata[id] || {};
            resolve(
              v?.name ||
                v?.subject ||
                v?.pushName ||
                parsePhoneNumber("+" + id.replace("@g.us", "")).format(
                  "INTERNATIONAL",
                ),
            );
          });
        } else {
          v =
            id === "0@s.whatsapp.net"
              ? {
                  id,
                  name: "WhatsApp",
                }
              : id === conn.decodeJid(conn?.user?.id)
                ? conn.user
                : conn.contacts[id] || {};
        }

        return (
          v?.name ||
          v?.subject ||
          v?.pushName ||
          v?.verifiedName ||
          parsePhoneNumber("+" + id.replace("@s.whatsapp.net", "")).format(
            "INTERNATIONAL",
          )
        );
      },
    },
        
        copyNForward: {
      async value(jid, message, forwardingScore = true, options = {}) {
        let vtype;
        if (options.readViewOnce && message.message.viewOnceMessage?.message) {
          vtype = Object.keys(message.message.viewOnceMessage.message)[0];
          delete message.message.viewOnceMessage.message[vtype].viewOnce;
          message.message = proto.Message.fromObject(
            JSON.parse(JSON.stringify(message.message.viewOnceMessage.message))
          );
          message.message[vtype].contextInfo =
            message.message.viewOnceMessage.contextInfo;
        }
        let mtype = Object.keys(message.message)[0];
        let m = generateForwardMessageContent(message, !!forwardingScore);
        let ctype = Object.keys(m)[0];
        if (
          forwardingScore &&
          typeof forwardingScore === "number" &&
          forwardingScore > 1
        )
          m[ctype].contextInfo.forwardingScore += forwardingScore;
        m[ctype].contextInfo = {
          ...(message.message[mtype].contextInfo || {}),
          ...(m[ctype].contextInfo || {}),
        };
        m = generateWAMessageFromContent(jid, m, {
          ...options,
          userJid: conn.user.jid,
        });
        await conn.relayMessage(jid, m.message, {
          messageId: m.key.id,
          additionalAttributes: { ...options },
        });
        return m;
      },
      enumerable: true,
    },

    sendContact: {
      async value(jid, number, quoted, options = {}) {
        let list = [];

        for (let v of number) {
          list.push({
            displayName: await conn.getName(v),
            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await conn.getName(
              v + "@s.whatsapp.net",
            )}\nFN:${await conn.getName(
              v + "@s.whatsapp.net",
            )}\nitem1.TEL;waid=${v}:${v}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:Irull2nd@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:https://izumii.xyz\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
          });
        }

        return conn.sendMessage(
          jid,
          {
            contacts: {
              displayName: `${list.length} Contact`,
              contacts: list,
            },
            mentions: quoted?.participant
              ? [conn.decodeJid(quoted?.participant)]
              : [conn.decodeJid(conn.user?.id)],
            ...options,
          },
          { quoted, ...options },
        );
      },
      enumerable: true,
    },

        parseMention: {
            value(text) {
                return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + "@s.whatsapp.net") || []
            }
        },

        downloadMediaMessage: {
            async value(message, filename) {
                let mime = {
                    imageMessage: "image",
                    videoMessage: "video",
                    stickerMessage: "sticker",
                    documentMessage: "document",
                    audioMessage: "audio",
                    ptvMessage: "video"
                }[message.type]

                if ("thumbnailDirectPath" in message.msg && !("url" in message.msg)) {
                    message = {
                        directPath: message.msg.thumbnailDirectPath,
                        mediaKey: message.msg.mediaKey
                    }
                    mime = "thumbnail-link"
                } else {
                    message = message.msg
                }

                return await baileys.toBuffer(await baileys.downloadContentFromMessage(message, mime))
            },
            enumerable: true
        },

        sendMedia: {
            async value(jid, url, quoted = "", options = {}) {
                let { mime, data: buffer, ext, size } = await Function.getFile(url)
                mime = options?.mimetype ? options.mimetype : mime
                let data = { text: "" }, mimetype = /audio/i.test(mime) ? "audio/mpeg" : mime

                if (size > 45000000) data = {
                    document: buffer,
                    mimetype: mime,
                    fileName: options?.fileName ? options.fileName : `${conn.user?.name} (${new Date()}).${ext}`,
                    ...options
                }
                else if (options.asDocument) data = {
                    document: buffer,
                    mimetype: mime,
                    fileName: options?.fileName ? options.fileName : `${conn.user?.name} (${new Date()}).${ext}`,
                    ...options
                }
                else if (options.asSticker || /webp/.test(mime)) {
                    let pathFile = await writeExif({ mimetype, data: buffer }, { ...options })
                    data = {
                        sticker: fs.readFileSync(pathFile),
                        mimetype: "image/webp",
                        ...options
                    }
                    fs.existsSync(pathFile) ? await fs.promises.unlink(pathFile) : ""
                }
                else if (/image/.test(mime)) data = {
                    image: buffer,
                    mimetype: options?.mimetype ? options.mimetype : "image/png",
                    ...options
                }
                else if (/video/.test(mime)) data = {
                    video: buffer,
                    mimetype: options?.mimetype ? options.mimetype : "video/mp4",
                    ...options
                }
                else if (/audio/.test(mime)) data = {
                    audio: buffer,
                    mimetype: options?.mimetype ? options.mimetype : "audio/mpeg",
                    ...options
                }
                else data = {
                    document: buffer,
                    mimetype: mime,
                    ...options
                }

                return await conn.sendMessage(jid, data, {
                    quoted, ...options
                })
            },
            enumerable: true
        },

        cMod: {
            value(jid, copy, text = "", sender = conn.user.id, options = {}) {
                let mtype = conn.getContentType(copy.message)
                let content = copy.message[mtype]

                if (typeof content === "string") copy.message[mtype] = text || content
                else if (content.caption) content.caption = text || content.text
                else if (content.text) content.text = text || content.text
                if (typeof content !== "string") {
                    copy.message[mtype] = { ...content, ...options }
                    copy.message[mtype].contextInfo = { ...(content.contextInfo || {}), mentionedJid: options.mentions || content.contextInfo?.mentionedJid || [] }
                }

                if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant
                if (copy.key.remoteJid.includes("@s.whatsapp.net")) sender = sender || copy.key.remoteJid
                else if (copy.key.remoteJid.includes("@broadcast")) sender = sender || copy.key.remoteJid
                copy.key.remoteJid = jid
                copy.key.fromMe = baileys.areJidsSameUser(sender, conn.user.id)
                return baileys.proto.WebMessageInfo.fromObject(copy)
            }
        },

        sendPoll: {
            async value(chatId, name, values, options = {}) {
                let selectableCount = options?.selectableCount ? options.selectableCount : 1

                return await conn.sendMessage(chatId, {
                    poll: {
                        name,
                        values,
                        selectableCount
                    },
                    ...options
                }, { ...options })
            },
            enumerable: true
        },
        
        sendOrder: {
            async value(jid, text, img, itcount, ammount, qnya = m) {
                const order = generateWAMessageFromContent(jid, proto.Message.fromObject({
"orderMessage": {
"orderId": "65bh4ddqr90",
"thumbnail": img,
"itemCount": itcount,
"status": "INQUIRY",
"surface": "CATALOG",
"orderTitle": "product",
"message": text,
"sellerJid": 'm.sender',
"token": "775BBQR0",
"totalAmount1000": ammount,
"totalCurrencyCode": "IDR",
"contextInfo": {
"mentionedJid": ['m.sender']
}}
}), { userJid: 'm.sender', quoted: qnya })
return conn.relayMessage(jid, order.message, { messageId: order.key.id})
            },
            enumerable: true
        },
        
        sendEvent: {
            async value(jid, text, des, loc, link) {
let msg = generateWAMessageFromContent(jid, {
        messageContextInfo: {
            messageSecret: randomBytes(32)
        },
        eventMessage: {
            isCanceled: false,
            name: text,
            description: des,
            location: {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: loc
            },
            joinLink: link,
            startTime: 'm.messageTimestamp'
        }
    }, {});

    conn.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
        })
            },
            enumerable: true
        },
        

        reply: {
            value(jid, text = "", quoted, options) {
                return Buffer.isBuffer(text) ? conn.sendMedia(jid, text, quoted, options) : conn.sendMessage(jid, { text, mentions: conn.parseMention(text), contextInfo: global.adReply.contextInfo, ...options }, { quoted })
            }
        },

        setProfilePicture: {
            async value(jid, media, type = "full") {
                let { data } = await Function.getFile(media)

                if (/full/i.test(type)) {
                    data = await Function.resizeImage(media, 720)
                    await conn.query({
                        tag: "iq",
                        attrs: {
                            to: await conn.decodeJid(jid),
                            type: "set",
                            xmlns: "w:profile:picture"
                        },
                        content: [{
                            tag: "picture",
                            attrs: {
                                type: "image"
                            },
                            content: data
                        }]
                    })
                } else {
                    data = await Function.resizeImage(media, 640)
                    await conn.query({
                        tag: "iq",
                        attrs: {
                            to: await conn.decodeJid(jid),
                            type: "set",
                            xmlns: "w:profile:picture"
                        },
                        content: [{
                            tag: "picture",
                            attrs: {
                                type: "image"
                            },
                            content: data
                        }]
                    })
                }
            },
            enumerable: true
        },
        
        sendButtonPay: {
        async value(jid, text, main, footer) {
	let msg = generateWAMessageFromContent(jid, {
  viewOnceMessage: {
    message: {
        "messageContextInfo": {
          "deviceListMetadata": {},
          "deviceListMetadataVersion": 2
        },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({
            text: text
          }),
          footer: proto.Message.InteractiveMessage.Footer.create({
            text: footer
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [{
                name: "review_and_pay",
                buttonParamsJson: JSON.stringify(main)
              },
              
              ],
          }),
        })
    }
  }
}, {})
conn.relayMessage(jid, msg.message, {
  messageId: msg.key.id,
})
}
},

        sendGroupV4Invite: {
            async value(jid, groupJid, inviteCode, inviteExpiration, groupName, jpegThumbnail, caption = "Invitation to join my WhatsApp Group", options = {}) {
                const media = await baileys.prepareWAMessageMedia({
                    image: (await Function.getFile(jpegThumbnail)).data
                }, {
                    upload: conn.waUploadToServer
                })

                const message = baileys.proto.Message.fromObject({
                    groupJid,
                    inviteCode,
                    inviteExpiration: inviteExpiration ? parseInt(inviteExpiration) : + new Date(new Date() + (3 * 86400000)),
                    groupName,
                    jpegThumbnail: media.imageMessage?.jpegThumbnail || jpegThumbnail,
                    caption
                })

                const m = baileys.generateWAMessageFromContent(jid, message, {
                    userJid: conn.user?.id
                })

                await conn.relayMessage(jid, m.message, {
                    messageId: m.key.id
                })

                return m
            },
            enumerable: true
        }
    })

    if (conn.user?.id) conn.user.jid = conn.decodeJid(conn.user?.id)
    return conn
}

export async function smsg(conn, m, hasParent) {
    if (!m) return m
    /**
     * @type {import('@adiwajshing/baileys').proto.WebMessageInfo}
     */
    let M = proto.WebMessageInfo
    m = M.fromObject(m)
    m.conn = conn
    let protocolMessageKey
    if (m.message) {
        if (m.mtype == 'protocolMessage' && m.msg.key) {
            protocolMessageKey = m.msg.key
            if (protocolMessageKey == 'status@broadcast') protocolMessageKey.remoteJid = m.chat
            if (!protocolMessageKey.participant || protocolMessageKey.participant == 'status_me') protocolMessageKey.participant = m.sender
            protocolMessageKey.fromMe = conn.decodeJid(protocolMessageKey.participant) === conn.decodeJid(conn.user.id)
            if (!protocolMessageKey.fromMe && protocolMessageKey.remoteJid === conn.decodeJid(conn.user.id)) protocolMessageKey.remoteJid = m.sender
        }
        if (m.quoted) if (!m.quoted.mediaMessage) delete m.quoted.download
    }
    if (!m.mediaMessage) delete m.download

    try {
        if (protocolMessageKey && m.mtype == 'protocolMessage') conn.ev.emit('message.delete', protocolMessageKey)
    } catch (e) {
        console.error(e)
    }
    return m
}

export async function Serialize(conn, msg) {
    const m = {}
    const botNumber = conn.decodeJid(conn.user?.id)

    if (!msg.message) return
    if (msg.key && msg.key.remoteJid == "status@broadcast") return

    m.message = baileys.extractMessageContent(msg.message)

    if (msg.key) {
        m.key = msg.key
        m.chat = conn.decodeJid(m.key.remoteJid)
        m.fromMe = m.key.fromMe
        m.id = m.key.id
        m.isBaileys = m.id.startsWith("BAE5")
        m.isGroup = m.chat.endsWith("@g.us")
        m.participant = !m.isGroup ? false : m.key.participant
        m.sender = conn.decodeJid(m.fromMe ? conn.user.id : m.isGroup ? m.participant : m.chat)
    }
    
    m.getQuotedObj = () => {
                const q = proto.WebMessageInfo.fromObject(conn?.loadMessage(quoted.id) || quoted.vM)
                return smsg(conn, q)
            }

    m.pushName = msg.pushName
    m.isOwner = m.sender && [...global.owner, botNumber.split("@")[0]].includes(m.sender.replace(/\D+/g, ""))

    if (m.isGroup) {
        m.metadata = await conn.groupMetadata(m.chat)
        m.admins = (m.metadata.participants.reduce((memberAdmin, memberNow) => (memberNow.admin ? memberAdmin.push({ id: memberNow.id, admin: memberNow.admin }) : [...memberAdmin]) && memberAdmin, []))
        m.isAdmin = !!m.admins.find((member) => member.id === m.sender)
        m.isBotAdmin = !!m.admins.find((member) => member.id === botNumber)
    }

    if (m.message) {
        m.type = conn.getContentType(m.message) || Object.keys(m.message)[0]
        m.msg = baileys.extractMessageContent(m.message[m.type]) || m.message[m.type]
        m.mentions = m.msg?.contextInfo?.mentionedJid || []
        m.body = m.msg?.text || m.msg?.conversation || m.msg?.caption || m.message?.conversation || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ""
        m.prefix = global.prefix.test(m.body) ? m.body.match(global.prefix)[0] : ""
        m.command = m.body && m.body.replace(m.prefix, "").trim().split(/ +/).shift()
        m.arg = m.body.trim().split(/ +/).filter(a => a) || []
        m.args = m.body.trim().replace(new RegExp("^" + Function.escapeRegExp(m.prefix), "i"), "").replace(m.command, "").split(/ +/).filter(a => a) || []
        m.text = m.args.join(" ")
        m.expiration = m.msg?.contextInfo?.expiration || 0
        m.timestamp = (typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : msg.messageTimestamp.low ? msg.messageTimestamp.low : msg.messageTimestamp.high) || m.msg.timestampMs * 1000
        m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath

        if (m.isMedia) {
            m.mime = m.msg?.mimetype
            m.size = m.msg?.fileLength
            m.height = m.msg?.height || ""
            m.width = m.msg?.width || ""

            if (/webp/i.test(m.mime)) {
                m.isAnimated = m.msg?.isAnimated
            }
        }

        m.reply = async(text, options = {}) => {
            let chatId = options?.from ? options.from : m.chat
            let quoted = options?.quoted ? options.quoted : m

            if ((Buffer.isBuffer(text) || /^data:.?\/.*?;base64,/i.test(text) || /^https?:\/\//.test(text) || fs.existsSync(text))) {
                let data = await Function.getFile(text)

                if (!options.mimetype && (/utf-8|json/i.test(data.mime) || data.ext == ".bin" || !data.ext)) {
                    return conn.sendMessage(chatId, { text, mentions: [m.sender, ...conn.parseMention(text)], ...options }, { quoted, ephemeralExpiration: m.expiration, ...options })
                } else {
                    return conn.sendMedia(m.chat, data.data, quoted, { ephemeralExpiration: m.expiration, ...options })
                }
            } else {
                return conn.sendMessage(chatId, { text, mentions: [m.sender, ...conn.parseMention(text)], ...options }, { quoted, ephemeralExpiration: m.expiration, ...options })
            }
        }

        m.download = (filepath) => {
            if (filepath) return conn.downloadMediaMessage(m, filepath)
            else return conn.downloadMediaMessage(m)
        }
    }

    // quoted line
    m.isQuoted = false

    if (m.msg?.contextInfo?.quotedMessage) {
        m.isQuoted = true
        m.quoted = {}
        m.quoted.message = baileys.extractMessageContent(m.msg?.contextInfo?.quotedMessage)

        if (m.quoted.message) {
            m.quoted.type = conn.getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0]
            m.quoted.msg = baileys.extractMessageContent(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type]
            m.quoted.key = {
                remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
                participant : m.msg?.contextInfo?.remoteJid?.endsWith("g.us") ? conn.decodeJid(m.msg?.contextInfo?.participant) : false,
                fromMe : baileys.areJidsSameUser(conn.decodeJid(m.msg?.contextInfo?.participant), conn.decodeJid(conn.user?.id)),
                id : m.msg?.contextInfo?.stanzaId
            }

            m.quoted.from = m.quoted.key.remoteJid
            m.quoted.fromMe = m.quoted.key.fromMe
            m.quoted.id = m.msg?.contextInfo?.stanzaId
            m.quoted.isBaileys = m.quoted.id.startsWith("BAE5")
            m.quoted.isGroup = m.quoted.from.endsWith("@g.us")
            m.quoted.participant = m.quoted.key.participant
            m.quoted.sender = conn.decodeJid(m.msg?.contextInfo?.participant)
            m.quoted.isOwner = m.quoted.sender && [...global.owner, botNumber.split("@")[0]].includes(m.quoted.sender.replace(/\D+/g, ""))

            if (m.quoted.isGroup) {
                m.quoted.metadata = await conn.groupMetadata(m.quoted.from)
                m.quoted.admins = (m.quoted.metadata.participants.reduce((memberAdmin, memberNow) => (memberNow.admin ? memberAdmin.push({ id: memberNow.id, admin: memberNow.admin }) : [...memberAdmin]) && memberAdmin, []))
                m.quoted.isAdmin = !! m.quoted.admins.find((member) => member.id === m.quoted.sender)
                m.quoted.isBotAdmin = !! m.quoted.admins.find((member) => member.id === botNumber)
            }

            m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
            m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ""
            m.quoted.prefix = global.prefix.test(m.quoted.body) ? m.quoted.body.match(global.prefix)[0] : ""
            m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.prefix, "").trim().split(/ +/).shift()
            m.quoted.arg = m.quoted.body.trim().split(/ +/).filter(a => a) || []
            m.quoted.args = m.quoted.body.trim().replace(new RegExp("^" + Function.escapeRegExp(m.quoted.prefix), "i"), "").replace(m.quoted.command, "").split(/ +/).filter(a => a) || []
            m.quoted.text = m.quoted.args.join(" ")
            m.quoted.isMedia = !! m.quoted.msg?.mimetype || !! m.quoted.msg?.thumbnailDirectPath

            if (m.quoted.isMedia) {
                m.quoted.mime = m.quoted.msg?.mimetype
                m.quoted.size = m.quoted.msg?.fileLength
                m.quoted.height = m.quoted.msg?.height || ""
                m.quoted.width = m.quoted.msg?.width || ""
                if (/webp/i.test(m.quoted.mime)) {
                    m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
                }
            }

            m.quoted.reply = (text, options = {}) => {
                return m.reply(text, { quoted: m.quoted, ...options })
            }

            m.quoted.download = (filepath) => {
                if (filepath) return conn.downloadMediaMessage(m.quoted, filepath)
                else return conn.downloadMediaMessage(m.quoted)
            }
            m.quoted.download = (filepath) => {
                if (filepath) return conn.downloadMediaMessage(m.quoted, filepath)
                else return conn.downloadMediaMessage(m.quoted)
            }
        }
    }

    return m
}

//—————「 Don"t change it 」—————//
let file = fileURLToPath(import.meta.url)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright("Update serialize.js"))
    import(`${file}?update=${Date.now()}`)
})