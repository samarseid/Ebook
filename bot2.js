import { Telegraf } from 'telegraf';

const bot = new Telegraf('8401337585:AAG9Wct3hs8O28afjtUhxqEHHRFfDb6sSFs');

bot.start((ctx) => {
  ctx.reply('📖 Web kitob ochish uchun tugma:', {
    reply_markup: {
      keyboard: [
        [
          {
            text: '📚 O‘qish',
            web_app: {
              url: 'https://ebook2-sepia.vercel.app/', // bu yerga link
            },
          },
        ],
      ],
      resize_keyboard: true,
    },
  });
});

bot.launch();