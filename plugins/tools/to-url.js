import { uploadFile } from "../../system/lib/sticker.js"

export default {
    command: ["tourl", "tolink"],
    description: "Convert images, videos, webp and audio into urls",
    example: "",
    name: "tourl",
    tags: "tools",

    media: true,

    run: async(m, { conn }) => {
        let quoted = m.isQuoted ? m.quoted : m
        let media = await quoted.download()
        let link = await uploadFile(media)

        m.reply(`Link: ${link.url_file}\nSize: ${link.filesize}`)
    }
}
