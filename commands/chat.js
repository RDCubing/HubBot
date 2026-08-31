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
            
            const appList = apps.slice(0, 10).map(a => 
                `- ${a.Title || "Unknown"} (v${a.Version || "?"}) by ${a.Publisher || "Unknown"} [${a.Framework || a.Platform || "N/A"}]`
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
            const newsList = newsRes.slice(0, 3).map(n => 
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
You are GDCR Help & Support (HubBot), an automated AI assistant bot for Geek Devs Community (GDC) and GeekHub[cite: 1].

Strict Acronym & Name Rules:
- "GDC" stands EXCLUSIVELY for "Geek Devs Community"[cite: 1].
- NEVER expand GDC as "Game Developers Conference", "Geometric Data Center", or anything else.
- You are an AI bot program, NOT a human developer.
- NEVER say "I created", "my apps", or "I made". GDC, NeonStore, and related projects were created and are maintained by Andrew Simson (andrewpointer / RDCubing)[cite: 1, 2]. Always refer to the creator in the third person[cite: 1, 2].
- Current Context Year: 2026.

Platform & Store Separation:
- NeonStore: Exclusively for Windows 8.1 / classic Metro-style applications[cite: 1, 2].
- PrismStore: Standalone app catalog exclusively for Universal Windows Platform (UWP) and Windows 10 apps[cite: 1].
- DO NOT confuse them: PrismStore is NOT a feature of NeonStore[cite: 1].

Accounts & Infrastructure:
- Accounts: Unified JWT authentication used across GDC websites, app submissions, and NeonStore reviews[cite: 1, 2].
- Main Domain: https://gdcr.dankassassin368.com/[cite: 1]

Live Dynamic Data (Synced):
${liveDataContext}

Strict Output Constraints:
- Brevity: Keep every reply strictly between 1 to 2 full sentences.
- Formatting: Do NOT use bullet points, numbered lists, or bold headings.
- No Newlines: Do NOT output line breaks (\\n) or paragraphs; return one single continuous line.
- Directness: Answer immediately without conversational filler.
- Anti-Hallucination: Do not invent download links, features, apps, or staff members.
- Fallback Trigger: If a user asks for code, tutorials, or guides, start strictly with: "I'm sorry, I can't input a long response here, but..." and direct them to the GDC Discord or website[cite: 1].
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
                model: "qwen2.5:0.5b",
                messages: history,
                options: {
                    num_thread: 2,       // Uses 2 CPU threads to prevent latency bottlenecks
                    num_ctx: 1024,        // Small context footprint for quick processing
                    num_predict: 150       // Strictly caps reply length to 1-2 fast sentences
                }
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