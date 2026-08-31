const { SlashCommandBuilder } = require("discord.js");
const { Ollama } = require("ollama");

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });
const userConversations = new Map();

// JSON Endpoints
const URLS = {
    projects: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/projects.json",
    neonRelease: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/update.json",
    prismRelease: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/updateprism.json",
    news: "https://raw.githubusercontent.com/RDCubing/gdcr-news-reimp2026/main/news/news.json"
};

let liveDataContext = "";

// Helper to fetch and build dynamic context
async function refreshLiveMemory() {
    try {
        const [projectsRes, neonRes, prismRes, newsRes] = await Promise.all([
            fetch(URLS.projects).then(r => r.json()).catch(() => null),
            fetch(URLS.neonRelease).then(r => r.json()).catch(() => null),
            fetch(URLS.prismRelease).then(r => r.json()).catch(() => null),
            fetch(URLS.news).then(r => r.json()).catch(() => null)
        ]);

        let contextParts = [];

        // 1. Process App Catalog (Projects)
        if (projectsRes) {
            const apps = Array.isArray(projectsRes)
                ? projectsRes
                : Object.values(projectsRes).filter(Array.isArray).flat();
            
            const appList = apps.slice(0, 15).map(a => 
                `- ${a.Title || "Unknown"} (v${a.Version || "?"}) by ${a.Publisher || "Unknown"} [Platform: ${a.Framework || a.Platform || "N/A"}]`
            ).join("\n");

            contextParts.push(`Current WebStore Applications:\n${appList}`);
        }

        // 2. Process Latest Store Releases
        if (neonRes) {
            const n = neonRes.NeonStore || (Array.isArray(neonRes) ? neonRes[0] : neonRes);
            contextParts.push(`NeonStore Latest Release: Version ${n.Version || "?"} (${n.Description || ""})`);
        }

        if (prismRes) {
            const p = prismRes.PrismStore || (Array.isArray(prismRes) ? prismRes[0] : prismRes);
            contextParts.push(`PrismStore Latest Release: Version ${p.Version || "?"} (${p.Description || ""})`);
        }

        // 3. Process Latest News
        if (newsRes && Array.isArray(newsRes)) {
            const newsList = newsRes.slice(0, 5).map(n => 
                `- [${n.newsId}] ${n.title} (by ${n.author}): ${n.description}`
            ).join("\n");

            contextParts.push(`Recent GDC News & Updates:\n${newsList}`);
        }

        liveDataContext = contextParts.join("\n\n");
    } catch (err) {
        console.error("Error updating live JSON memory:", err);
    }
}

// Initial fetch + periodic background update every 5 minutes
refreshLiveMemory();
setInterval(refreshLiveMemory, 5 * 60 * 1000);

function getSystemPrompt() {
    return `
You are GDCR Help & Support (HubBot), the official AI assistant for the Geek Devs Community (GDC) and GeekHub[cite: 1, 9].

Core Identity & Knowledge:
- Creator & Maintainer: andrewpointer / Andrew Simson (RDCubing)[cite: 1, 11].
- Context Year: 2026.
- Mission: A developer-focused community dedicated to programming, system customization, software engineering, and classic software preservation[cite: 1].
- Store Distinctions:
  * NeonStore: Exclusively for Windows 8.1 apps & classic Metro experience[cite: 1, 11].
  * PrismStore: Exclusively for Universal Windows Platform (UWP) & Windows 10 apps[cite: 6].
- Accounts & Services: Uses a unified JWT authentication system for login, reviews, and app submissions[cite: 5, 10, 11].

Live Dynamic Database & News (Auto-Synced):
${liveDataContext}

Response Constraints & Behavior:
- Keep all replies extremely short, direct, and concise (1-3 sentences maximum).
- If an answer requires a lengthy explanation, deep tutorial, or extensive code breakdown, start your response with: "I'm sorry, I can't input a long response here, but..." and provide a brief high-level summary or direct the user to the relevant GDC website page or Discord channel[cite: 1, 9].
`.trim();
}

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

        // Initialize or update conversation history with fresh dynamic prompt
        if (shouldReset || !userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "system", content: getSystemPrompt() }
            ]);
        } else {
            // Keep the system prompt updated with the latest live data
            userConversations.get(userId)[0] = { role: "system", content: getSystemPrompt() };
        }

        const history = userConversations.get(userId);
        history.push({ role: "user", content: prompt });

        // Maintain bounded context to save VPS RAM
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