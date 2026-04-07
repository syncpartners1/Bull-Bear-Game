// server/src/bot.js
// Telegram Bot API webhook handler.
// Handles /start, /rules, /cards, /invite, /ai commands.
 
const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL    = process.env.APP_URL || 'https://bull-and-bear.up.railway.app';
const BOT_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;
 
// ─── Telegram API helpers ─────────────────────────────────────────────────────
 
async function call(method, body) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`${BOT_API}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}
 
function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}
 
// ─── Bot setup ────────────────────────────────────────────────────────────────
 
/**
 * Registers the webhook URL with Telegram and sets the bot command list.
 * Called once at server startup.
 */
export async function setupBot(webhookUrl) {
  if (!BOT_TOKEN) {
    console.log('[bot] No TELEGRAM_BOT_TOKEN — bot commands disabled');
    return;
  }
 
  // Register webhook
  const wh = await call('setWebhook', {
    url:             webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  console.log('[bot] setWebhook:', wh?.ok ? 'OK' : wh?.description);
 
  // Register commands visible in the Telegram UI
  await call('setMyCommands', {
    commands: [
      { command: 'start',  description: 'Open Bull & Bear' },
      { command: 'rules',  description: 'How to play' },
      { command: 'cards',  description: 'Card types & abilities' },
      { command: 'invite', description: 'Invite friends to a game' },
      { command: 'ai',     description: 'Play vs AI (solo)' },
    ],
  });
 
  // Set the persistent menu button in every chat
  await call('setChatMenuButton', {
    menu_button: {
      type:    'web_app',
      text:    '🎮 Play',
      web_app: { url: APP_URL },
    },
  });
 
  console.log('[bot] commands and menu button registered');
}
 
// ─── Webhook handler ──────────────────────────────────────────────────────────
 
/**
 * Express middleware — call from POST /webhook route.
 */
export function handleUpdate(req, res) {
  res.sendStatus(200); // always ack quickly
 
  const update = req.body;
  const msg    = update?.message;
  if (!msg) return;
 
  const chatId = msg.chat.id;
  const text   = (msg.text ?? '').trim();
  const from   = msg.from;
 
  // Parse command and optional payload (e.g. /start GAMEID)
  const [rawCmd, ...args] = text.split(' ');
  const cmd     = rawCmd.split('@')[0].toLowerCase(); // strip @BotName suffix
  const payload = args.join(' ').trim();
 
  switch (cmd) {
    case '/start': return handleStart(chatId, from, payload);
    case '/rules': return handleRules(chatId);
    case '/cards': return handleCards(chatId);
    case '/invite':return handleInvite(chatId, payload);
    case '/ai':    return handleAI(chatId, from);
    default:       return handleUnknown(chatId);
  }
}
 
// ─── Command handlers ─────────────────────────────────────────────────────────
 
function handleStart(chatId, from, gameId) {
  const firstName = from?.first_name ?? 'there';
 
  const welcomeText =
    `👋 <b>Welcome to Bull &amp; Bear, ${firstName}!</b>\n\n` +
    `📈 A multiplayer financial strategy card game for 2–5 players.\n\n` +
    `<b>Quick start:</b>\n` +
    `• Tap <b>🎮 Play</b> below to open the game\n` +
    `• Or use <b>/ai</b> to play solo against AI opponents\n` +
    `• Share your Game ID with friends and use <b>/invite</b> to send a link\n\n` +
    `<b>Learn more:</b>\n` +
    `/rules — How to play\n` +
    `/cards — Card types &amp; abilities`;
 
  // Deep-link into a specific game if payload present
  const webAppUrl = gameId ? `${APP_URL}?startapp=${gameId}` : APP_URL;
 
  return sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Play Now', web_app: { url: webAppUrl } },
      ]],
    },
  });
}
 
function handleRules(chatId) {
  const text =
    `📖 <b>How to Play Bull &amp; Bear</b>\n\n` +
    `<b>Goal:</b> Finish with the highest score by holding cards in Bull (rising) markets.\n\n` +
    `<b>Each turn you draw 3 cards and MUST assign them:</b>\n` +
    `1️⃣ One card → your own portfolio\n` +
    `2️⃣ One card → the Central Market (Bull ▲ or Bear ▼ zone)\n` +
    `3️⃣ One card → any opponent's portfolio\n\n` +
    `<b>Sectors:</b> Technology 💻 · Finance 🏦 · Energy ⚡ · Pharma 💊\n\n` +
    `<b>Scoring:</b>\n` +
    `• Each sector gets an Index: Bull cards vs Bear cards\n` +
    `  More Bull → Index <b>+1</b> · More Bear → Index <b>-1</b> · Tied → <b>0</b>\n` +
    `• Your score = Σ (card value × sector index)\n` +
    `• <b>Mission bonus</b>: each player has 2 secret missions worth extra points\n\n` +
    `<b>Game ends</b> when the deck is exhausted. Highest score wins! 🏆\n\n` +
    `Use /cards to see every card type and its ability.`;
 
  return sendMessage(chatId, text);
}
 
function handleCards(chatId) {
  const text =
    `🃏 <b>Card Types &amp; Abilities</b>\n\n` +
    `<b>📈 Share Unit</b>  ·  Value: 1\n` +
    `Standard market share. Scores +1 or -1 per sector index.\n\n` +
    `<b>🛡️ Regulated Asset</b>  ·  Value: 1\n` +
    `Protected card — <i>cannot be removed</i> by a Hostile Takeover.\n\n` +
    `<b>🔒 Insider Trading</b>  ·  Value: 1\n` +
    `Played <b>face-down</b>. Hidden from all players until the end of the game, ` +
    `then revealed and scored normally.\n\n` +
    `<b>🤝 Strategic Merger</b>  ·  Value: 2\n` +
    `Worth double points. Scores 2 × sector index.\n\n` +
    `<b>⚔️ Hostile Takeover</b>  ·  Value: 1\n` +
    `<b>Active Ability:</b> after playing to a portfolio, you may remove any ` +
    `non-Regulated card from any portfolio or market zone. If you skip the ability ` +
    `it scores as a normal Share Unit.\n\n` +
    `<b>🔄 Pivot</b>  ·  Value: 1\n` +
    `Wildcard. When played you choose which sector it represents — ` +
    `acts as a Share Unit for that sector.`;
 
  return sendMessage(chatId, text);
}
 
function handleInvite(chatId, existingGameId) {
  // Deep-link: opens Mini App with the Game ID pre-filled via startapp param
  const gameId  = existingGameId || '';
  const linkUrl = gameId
    ? `${APP_URL}?startapp=${gameId}`
    : APP_URL;
 
  const text = gameId
    ? `🔗 <b>Invite friends to your game!</b>\n\nShare this link — it opens the game directly:\n${linkUrl}\n\nOr share your <b>Game ID</b>: <code>${gameId}</code>`
    : `🔗 <b>Invite friends to Bull &amp; Bear!</b>\n\nShare this link to open the game:\n${linkUrl}\n\n<i>Tip: start a game first, then use <b>/invite GAMEID</b> to share your specific game room.</i>`;
 
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Join Game', url: linkUrl },
      ]],
    },
  });
}
 
function handleAI(chatId, from) {
  const firstName = from?.first_name ?? 'there';
  const aiUrl     = `${APP_URL}?mode=ai`;
 
  return sendMessage(chatId,
    `🤖 <b>Play vs AI, ${firstName}!</b>\n\n` +
    `Tap below to start a solo game against AI opponents.\n` +
    `Choose how many AI players you want to face (1–4).`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🤖 Play vs AI', web_app: { url: aiUrl } },
        ]],
      },
    }
  );
}
 
function handleUnknown(chatId) {
  return sendMessage(chatId,
    `❓ Unknown command.\n\nTry:\n/start · /rules · /cards · /invite · /ai`
  );
}