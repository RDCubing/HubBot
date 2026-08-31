const { SlashCommandBuilder } = require("discord.js");
const { Ollama } = require("ollama");

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });
const userConversations = new Map();

// Official memory and system prompt
const BOT_MEMORY = `
You are GDCR Help & Support, the official AI assistant for the GDCR Community and GeekHub.
Key knowledge to remember:
- Creator: andrewpointer.
- Primary purpose: Assisting users with GeekHub apps, and Store catalogs like NeonStore for 8.1, and PrismStore for UWP/10.
- Tone: Helpful, clear, and concise. Keep answers short and relevant to Discord.
`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("chat")
        .setDescription("Chat with GDCR Help & Support")
        .addStringOption(option =>
            option
                .setName("prompt")
                .setDescription("Your question or message")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("reset")
                .setDescription("Clear conversation memory")
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const prompt = interaction.options.getString("prompt");
        const shouldReset = interaction.options.getBoolean("reset") || false;
        const userId = interaction.user.id;

        // Initialize or reset session with your specific knowledge
        if (shouldReset || !userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "system", content: BOT_MEMORY.trim() }
            ]);
        }

        const history = userConversations.get(userId);
        history.push({ role: "user", content: prompt });

        // Maintain bounded context (system prompt + 8 turns) to save VPS RAM
        if (history.length > 9) {
            history.splice(1, 2);
        }

        try {
            const response = await ollama.chat({
                model: "llama3.2:3b",
                messages: history
            });

            const replyText = response.message.content || "No response generated.";
            history.push({ role: "assistant", content: replyText });

            const finalReply = replyText.length > 2000 
                ? replyText.slice(0, 1990) + "..." 
                : replyText;

            await interaction.editReply(finalReply);
        } catch (error) {
            console.error("Ollama Chat Error:", error);
            await interaction.editReply("❌ Failed to reach the local AI engine.");
        }
    }
};