import { Env } from "..";

// send telegram message to chatid
export async function sendTelegramMessage(
  chatId: string,
  message: string,
  env: Env["variables"],
) {
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || "no token";
  await sendChatAction(chatId, "typing", TELEGRAM_BOT_TOKEN);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${message}`;
  const response = await fetch(url);
  return response;
}

// send chat action to chatid
async function sendChatAction(
  chatId: string,
  action: string,
  TELEGRAM_BOT_TOKEN: string,
) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction?chat_id=${chatId}&action=${action}`;
  const response = await fetch(url);
  return response;
}
