const login = require("facebook-chat-api");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const { downloadImageFromUnsplash } = require("./getImageUnsplash");

// بيانات تسجيل الدخول
const credential = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf-8')) };
const prefix = "!"; // البادئة للأوامر

// إيدي أدمن البوت
const botAdminId = "61583321681266";

// إنشاء البوت
login(credential, (err, api) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log("تم تسجيل دخول البوت بنجاح!");

  // الاستماع للرسائل الواردة
  api.listenMqtt((err, message) => {
    if (err) {
      console.error(err);
      return;
    }

    handleMessage(api, message);
  });
});

// التعامل مع الرسائل
function handleMessage(api, message) {
  if (!message.body) return;

  const body = message.body.trim();
  const threadId = message.threadID;

  if (!body.startsWith(prefix)) return;

  const [command, ...args] = body.slice(prefix.length).split(" ");

  switch (command.toLowerCase()) {
    case "هلا": // !hi
      api.sendMessage({
        body: 'مرحباً @الرفيق! أنا بوت مجموعة فيسبوك. استخدم !مساعدة لمعرفة الأوامر! 😄',
        mentions: [{
          tag: '@الرفيق',
          id: message.senderID,
          fromIndex: 8
        }]
      }, threadId);
      break;

    case "مساعدة": // !help
      sendHelpMessage(api, threadId);
      break;

    case "مساعدة-لعبة": // !help-game
      sendGameHelpMessage(api, threadId);
      break;

    case "كرر": // !echo
      sendEchoMessage(api, threadId, args.join(" "));
      break;

    case "اضف": // !add
      if (args.length === 1) {
        const memberId = args[0];
        addUserToGroup(api, memberId, threadId);
      } else {
        sendErrorMessage(api, threadId, "❌ الاستخدام الصحيح: !اضف <memberId>");
      }
      break;

    case "صورة": // !img
      if (args.length === 1) {
        sendImageFromGoogle(api, threadId, args[0]);
      } else {
        sendErrorMessage(api, threadId, "❌ الاستخدام الصحيح: !صورة <اسم الصورة>");
      }
      break;

    case "صورة-عالية": // !imgu
      if (args.length === 1) {
        sendImageFromUnsplash(api, threadId, args[0]);
      } else {
        sendErrorMessage(api, threadId, "❌ الاستخدام الصحيح: !صورة-عالية <موضوع>");
      }
      break;

    case "لعبة": // !game
      if (gameActive) {
        sendErrorMessage(api, threadId, "لعبة قيد التشغيل، انتظر حتى تنتهي.");
      } else {
        sendAnimeCharacterImage(api, threadId);
      }
      break;

    case "اجابة": // !ans
      if (gameActive) {
        const guessedAnswer = args.join(" ").trim();
        processAnswer(api, threadId, guessedAnswer);
      } else {
        sendErrorMessage(api, threadId, "لا توجد لعبة حالياً. استخدم !لعبة لبدء جديدة.");
      }
      break;

    default:
      sendErrorMessage(api, threadId, "❌ أمر غير معروف. استخدم !مساعدة لمعرفة الأوامر.");
      break;
  }
}

// الدوال المساعدة (أمثلة: إرسال المساعدة، الإيكو، الأخطاء، إضافة عضو، الصور...)

function sendHelpMessage(api, threadId) {
  const helpMessage =
    "بوت مجموعة فيسبوك\n" +
    "الإصدار: 1.3 (بيتا)\n\n" +
    "الأوامر المتاحة:\n" +
    `${prefix}هلا: للترحيب بالبوت\n` +
    `${prefix}مساعدة: عرض قائمة الأوامر\n` +
    `${prefix}كرر <رسالة>: يكرر الرسالة المرسلة\n` +
    `${prefix}اضف <memberId>: لإضافة عضو للمجموعة\n` +
    `${prefix}صورة <اسم الصورة>: جلب صورة من جوجل\n` +
    `${prefix}صورة-عالية <موضوع>: جلب صورة عالية الجودة من Unsplash\n` +
    `${prefix}مساعدة-لعبة: مساعدة للعبة الأنمي`;

  sendMessage(api, threadId, helpMessage);
}

function sendGameHelpMessage(api, threadId) {
  const helpMessage = `
مرحبا بك في لعبة تخمين شخصيات الأنمي!
    
الأوامر:
${prefix}لعبة: بدء لعبة جديدة.
${prefix}اجابة <اسم الشخصية>: لتقديم إجابتك.
${prefix}مساعدة-لعبة: عرض هذا الدليل.
    
طريقة اللعب:
1. استخدم !لعبة لبدء لعبة جديدة.
2. سيرسل البوت صورة لشخصية أنمي.
3. خمن اسم الشخصية وأرسل باستخدام !اجابة.
4. الإجابة الصحيحة ستظهر رسالة تهنئة.
5. إذا كانت الإجابة خاطئة، حاول مرة أخرى.
    
استمتع باللعبة!
  `;

  sendMessage(api, threadId, helpMessage);
}

function sendEchoMessage(api, threadId, message) {
  sendMessage(api, threadId, `لقد قلت: "${message}"`);
}

function sendErrorMessage(api, threadId, errorMessage) {
  sendMessage(api, threadId, errorMessage);
}

function sendMessage(api, threadId, message) {
  api.sendMessage(message, threadId, (err) => {
    if (err) console.error(err);
  });
}

// إضافة عضو للمجموعة
function addUserToGroup(api, memberId, threadId) {
  api.addUserToGroup(memberId, threadId, (err) => {
    if (err) {
      sendErrorMessage(api, threadId, "❌ فشل في إضافة العضو للمجموعة.");
      return;
    }
    sendMessage(api, threadId, "✅ تم إضافة العضو للمجموعة بنجاح.");
  });
}
