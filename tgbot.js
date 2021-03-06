// https://github.com/yagop/node-telegram-bot-api/issues/476
process.env.NTBA_FIX_319 = 1

const getUrls = require('get-urls')
const xf = require('xfetch-js')
const TelegramBot = require('node-telegram-bot-api')
const getVideo = require('./getvid')
const getBestThumbnail = require('./thumbnail')
const bot = new TelegramBot(process.env.TG_TOKEN)

const parseId = url => {
	try {
		const u = new URL(url)
		const d = u.hostname
			.split('.')
			.reverse()
			.slice(0, 2)
			.reverse()
			.join('.')
		switch (d) {
			case 'youtube.com':
				return u.searchParams.get('v')
			case 'youtu.be':
				return u.pathname.slice(1)
			default:
				console.log(u)
				throw new Error('Invalid URL!')
		}
	} catch (e) {
		throw new Error('Invalid URL!')
	}
}
bot.on('text', async msg => {
	if (/^\/start/.test(msg.text)) {
		return bot.sendMessage(
			msg.chat.id,
			'Send a YouTube video URL to me, and I will retrieve raw video URL for you.'
		)
	}
	console.info(msg)
	const urls = getUrls(msg.text)
	let validUrlCnt = 0
	for (const url of urls) {
		try {
			const id = parseId(url)
			const { stream, adaptive, meta } = await getVideo(id)
			const thumbnail = await getBestThumbnail(meta.thumbnail_url)
			const { message_id: photomsgid } = await bot.sendPhoto(msg.chat.id, thumbnail, {
				caption: `[${meta.title}](https://www.youtube.com/watch?v=${id})`,
				parse_mode: 'Markdown'
			})
			const sstr = '**Stream**\n' + stream.map(s => `[${s.quality}](${s.url})`).join('\n')
			const astr =
				'**Adaptive**\n' +
				adaptive.map(s => `[${(s.quality_label ? s.quality_label + ':' : '') + s.type}](${s.url})`).join('\n')
			await bot.sendMessage(msg.chat.id, `Video **${id}**\n` + sstr + '\n' + astr, {
				parse_mode: 'Markdown',
				reply_to_message_id: photomsgid
			})
			validUrlCnt++
		} catch (e) {
			// invalid url
		}
	}
	if (validUrlCnt === 0) {
		// show error message if the message doesn't contain any URL
		await bot.sendMessage(
			msg.chat.id,
			'Invalid URL!\nSend a correct URL to me, and I will retrieve raw video URL for you.'
		)
	}
})

const WEBHOOK_PATH = '/bot' + process.env.TG_TOKEN
bot.setWebHook(process.env.WEBHOOK_URL + WEBHOOK_PATH)
	.then(() => bot.getWebHookInfo())
	.then(console.info)
exports.bot = bot
exports.WEBHOOK_PATH = WEBHOOK_PATH

if (require.main === module) {
	bot.startWebhook(WEBHOOK_PATH, null, process.env.PORT)
}
