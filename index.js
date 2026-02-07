require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");


/* ================================
   Environment Check
================================ */

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

/* ================================
   Discord Client
================================ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ================================
   OpenAI Client
================================ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", 
});

/* ================================
   Conversation Memory (per user)
================================ */

const memory = new Map();
const MAX_HISTORY = 10;

/* ================================
   Ready
================================ */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ================================
   Message Handler
================================ */

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    if (!message.mentions.has(client.user)) return;

    const userText = message.content
      .replace(/<@!?(\d+)>/g, "")
      .trim();

    if (!userText) {
      return message.reply("👋 You pinged me! Say something after the mention.");
    }

    const userId = message.author.id;

    if (!memory.has(userId)) {
      memory.set(userId, []);
    }

    const history = memory.get(userId);

    history.push({ role: "user", content: userText });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    await message.channel.sendTyping();

    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful, friendly Discord bot. Keep replies concise and natural.",
        },
        ...history,
      ],
    });

    const reply = response.choices?.[0]?.message?.content;

    if (!reply) {
      return message.reply("⚠️ I couldn’t generate a response.");
    }

    history.push({ role: "assistant", content: reply });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    if (reply.length > 2000) {
      await message.reply(reply.slice(0, 1990) + "…");
    } else {
      await message.reply(reply);
    }
  } catch (err) {
    console.error("❌ Error:", err);

    if (err.status === 429) {
      message.reply("🚫 I'm being rate-limited. Try again in a bit.");
    } else {
      message.reply("⚠️ Something went wrong.");
    }
  }
});

/* ================================
   Login
================================ */
client.login(process.env.DISCORD_TOKEN);
