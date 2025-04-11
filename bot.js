require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// logging
function logMessage(type, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

logMessage("INFO", "🤖 Bot is running...");

// start command
bot.onText(/^\/start/, (msg) => {
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    logMessage(
      "WARN",
      `[${msg.from.username}] tried to use /start outside a group.`
    );
    bot.sendMessage(msg.chat.id, "🚫 This bot can only be used in groups.");
    return;
  }

  logMessage(
    "INFO",
    `[${msg.chat.title}] ${msg.from.username} executed /start command.`
  );
  bot.sendMessage(
    msg.chat.id,
    `
    👋 *Halo! Saya adalah bot Absensi.*

    Berikut adalah daftar perintah yang tersedia:

    - \`/set <NIM Nama>\`  
    Untuk mengatur NIM dan Nama. Jangan gunakan tanda <>.

    - \`/absensi <Mata Kuliah> <Durasi (menit)>\`  
    Untuk memulai absensi. Jangan gunakan tanda <>.

    Selamat menggunakan! 😊
    `,
    { parse_mode: "Markdown" }
  );
});

// set command
bot.onText(/^\/set (.+)/, async (msg, match) => {
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") return;

  const telegramId = msg.from.id.toString();
  const [nim, ...nameParts] = match[1].split(" ");
  const name = nameParts.join(" ");

  if (!nim || !name) {
    bot.sendMessage(msg.chat.id, "Invalid format. Use: `/set <NIM Name>`", {
      parse_mode: "Markdown",
    });
    logMessage(
      "WARN",
      `[${msg.chat.title}] ${msg.from.username} used incorrect format for /set.`
    );
    return;
  }

  await prisma.user.upsert({
    where: { telegramId },
    update: { nim, name },
    create: { telegramId, nim, name },
  });

  logMessage(
    "INFO",
    `[${msg.chat.title}] ${msg.from.username} set data: ${nim} - ${name}`
  );
  bot.sendMessage(msg.chat.id, `✅ Data saved!\n${nim} - ${name}`);
});

// absensi (attendance) command
bot.onText(/^\/absensi (.+) (\d+)/, async (msg, match) => {
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") return;

  const [_, subject, durasi] = match;
  const chatId = msg.chat.id.toString();

  const durasiMenit = parseInt(durasi);
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durasiMenit * 60 * 1000);

  const formattedEnd = endTime.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const message = await bot.sendMessage(
    chatId,
    `**Absensi dibuka**!\n\n📋 Mata Kuliah: ${subject}\n⏰ Ditutup: ${formattedEnd}\n\nKlik tombol di bawah untuk absen.\n\n📝 Daftar Hadir:\n(Belum ada)\n\n`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Hadir", callback_data: "absen" }],
          [{ text: "❌ Batal Absensi", callback_data: "batal" }],
          [{ text: "🛑 Tutup Absensi", callback_data: "tutup" }],
        ],
      },
    }
  );

  const attendance = await prisma.attendance.create({
    data: {
      chatId,
      messageId: message.message_id.toString(),
      subject,
      startTime: new Date(),
      endTime: new Date(Date.now() + durasi * 60 * 1000),
      initiatorId: msg.from.id.toString(),
    },
  });

  // automatically close attendance
  setTimeout(async () => {
    try {
      // delete old attendancelist message
      await bot.deleteMessage(chatId, message.message_id);

      // get present list absence
      const presentList = await prisma.attendanceList.findMany({
        where: { attendanceId: attendance.id },
      });

      const userData = await Promise.all(
        presentList.map(async (p, i) => {
          const u = await prisma.user.findUnique({
            where: { telegramId: p.telegramId },
          });
          return `${i + 1}. ${u ? `${u.nim} - ${u.name}` : p.telegramId}`;
        })
      );

      // send new message with present list
      await bot.sendMessage(
        chatId,
        `🛑 Absensi untuk *${subject}* telah ditutup otomatis.\n\n📝 Daftar Hadir:\n${userData.join(
          "\n"
        )}`,
        { parse_mode: "Markdown" }
      );

      logMessage("INFO", `[${subject}] Attendance closed automatically.`);
    } catch (err) {
      logMessage(
        "ERROR",
        `Failed to close attendance automatically: ${err.message}`
      );
    }
  }, durasiMenit * 60 * 1000);

  logMessage(
    "INFO",
    `[${msg.chat.title}] Attendance for "${subject}" started by ${msg.from.username} for ${durasi} minutes.`
  );
  bot.sendMessage(
    chatId,
    `⏳ Absensi ${subject} aktif selama ${durasi} menit.`
  );
});

// handle button / callback
bot.on("callback_query", async (query) => {
  if (!query.message || !query.from.id) return;
  const telegramId = query.from.id.toString();
  const chatId = query.message.chat.id.toString();
  const messageId = query.message.message_id.toString();

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    logMessage(
      "WARN",
      `[${chatId}] ${query.from.username} has not set NIM/Name when trying to click the button`
    );
    bot.answerCallbackQuery(query.id, {
      text: "❌ Kamu belum set NIM dan Nama.\nKetik /set <NIM Nama> dulu.",
      show_alert: true,
    });
    return;
  }

  const attendance = await prisma.attendance.findFirst({
    where: { chatId, messageId },
    include: { presentList: true },
  });

  if (!attendance) {
    logMessage(
      "WARN",
      `[${chatId}] Attendance not found when the button was clicked`
    );
    bot.answerCallbackQuery(query.id, { text: "Absensi tidak ditemukan." });
    return;
  }

  const alreadyattendance = attendance.presentList.find(
    (p) => p.telegramId === telegramId
  );

  switch (query.data) {
    case "absen":
      if (alreadyattendance) {
        bot.answerCallbackQuery(query.id, { text: "Kamu sudah absen!" });
        return;
      }

      await prisma.attendanceList.create({
        data: {
          attendanceId: attendance.id,
          telegramId,
          time: new Date(),
        },
      });

      logMessage(
        "INFO",
        `[${attendance.subject}] ${user.nim} - ${user.name} marked attendance.`
      );
      bot.answerCallbackQuery(query.id, { text: "Absensi berhasil!" });
      break;

    case "batal":
      if (!alreadyattendance) {
        bot.answerCallbackQuery(query.id, { text: "Kamu belum absen." });
        return;
      }

      await prisma.attendanceList.delete({
        where: { id: alreadyattendance.id },
      });
      logMessage(
        "INFO",
        `[${attendance.subject}] ${user.nim} - ${user.name} canceled attendance.`
      );
      bot.answerCallbackQuery(query.id, {
        text: "✅ Absensi kamu dibatalkan.",
      });
      break;

    case "tutup":
      try {
        // check is user admin grup
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some((admin) => admin.user.id === query.from.id);

        if (!isAdmin) {
          bot.answerCallbackQuery(query.id, {
            text: "❌ Hanya admin grup yang dapat menutup absensi.",
            show_alert: true,
          });
            logMessage(
            "WARN",
            `[${chatId}] ${query.from.username} attempted to close attendance without admin privileges.`
            );
          return;
        }

        // delete old attendancelist message
        await bot.deleteMessage(chatId, messageId);

        // get present list absence
        const presentList = await prisma.attendanceList.findMany({
          where: { attendanceId: attendance.id },
        });

        const userData = await Promise.all(
          presentList.map(async (p, i) => {
            const u = await prisma.user.findUnique({
              where: { telegramId: p.telegramId },
            });
            return `${i + 1}. ${u ? `${u.nim} - ${u.name}` : p.telegramId}`;
          })
        );

        // send new message with present list
        await bot.sendMessage(
          chatId,
          `🛑 Absensi ${attendance.subject} telah ditutup oleh ${query.from.username}`,
          { parse_mode: "Markdown" }
        );
        const currentTime = new Date().toLocaleString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        await bot.sendMessage(
          chatId,
          `📋 Mata Kuliah: ${attendance.subject}\n⏰ Ditutup: ${currentTime} \n\n📝 Daftar Hadir:\n${userData.join(
            "\n"
          )}`,
          { parse_mode: "Markdown" }
        );

        logMessage(
          "INFO",
          `[${attendance.subject}] Attendance closed by ${query.from.username}.`
        );
        bot.answerCallbackQuery(query.id, { text: "🛑 Absensi ditutup." });
      } catch (err) {
        logMessage(
          "ERROR",
          `Failed to close attendance manually: ${err.message}`
        );
        bot.answerCallbackQuery(query.id, {
          text: "❌ Gagal menutup absensi.",
          show_alert: true,
        });
      }
      return;

    default:
      logMessage("WARN", `❓ Unknown button: ${query.data}`);
      bot.answerCallbackQuery(query.id, { text: "Aksi tidak dikenali." });
      return;
  }

  // update present list
  const presentList = await prisma.attendanceList.findMany({
    where: { attendanceId: attendance.id },
  });

  const userData = await Promise.all(
    presentList.map(async (p, i) => {
      const u = await prisma.user.findUnique({
        where: { telegramId: p.telegramId },
      });
      return `${i + 1}. ${u ? `${u.nim} - ${u.name}` : p.telegramId}`;
    })
  );

  const formattedEnd = attendance.endTime.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await bot.editMessageText(
    `**Absensi dibuka**!\n\n📋 Mata Kuliah: ${
      attendance.subject
    }\n⏰ Ditutup: ${formattedEnd}\n\nKlik tombol di bawah untuk absen.\n\n📝 Daftar Hadir:\n${userData.join(
      "\n"
    )}`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Saya Hadir", callback_data: "absen" }],
          [{ text: "❌ Batal Absen", callback_data: "batal" }],
          [{ text: "🛑 Tutup Absensi", callback_data: "tutup" }],
        ],
      },
    }
  );
});
