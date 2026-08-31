const { SlashCommandBuilder } = require("discord.js");
const { Ollama } = require("ollama");

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });
const userConversations = new Map();

// Raw JSON Endpoints
const URLS = {
    projects: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/projects.json",
    neonRelease: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/update.json",
    prismRelease: "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/updateprism.json",
    news: "https://raw.githubusercontent.com/RDCubing/gdcr-news-reimp2026/main/news/news.json"
};

let liveDataContext = "";

// Dynamic JSON Memory Fetcher
async function refreshLiveMemory() {
    try {
        const [projectsRes, neonRes, prismRes, newsRes] = await Promise.all([
            fetch(URLS.projects).then(r => r.json()).catch(() => null),
            fetch(URLS.neonRelease).then(r => r.json()).catch(() => null),
            fetch(URLS.prismRelease).then(r => r.json()).catch(() => null),
            fetch(URLS.news).then(r => r.json()).catch(() => null)
        ]);

        let contextParts = [];

        // 1. App Catalog
        if (projectsRes) {
            const apps = Array.isArray(projectsRes)
                ? projectsRes
                : Object.values(projectsRes).filter(Array.isArray).flat();
            
            const appList = apps.slice(0, 15).map(a => 
                `- ${a.Title || "Unknown"} (v${a.Version || "?"}) by ${a.Publisher || "Unknown"} [Platform: ${a.Framework || a.Platform || "N/A"}]`
            ).join("\n");

            contextParts.push(`Current Live WebStore Applications:\n${appList}`);
        }

        // 2. Latest Releases
        if (neonRes) {
            const n = neonRes.NeonStore || (Array.isArray(neonRes) ? neonRes[0] : neonRes);
            contextParts.push(`NeonStore Latest Release: Version ${n.Version || "?"} (${n.Description || ""})`);
        }

        if (prismRes) {
            const p = prismRes.PrismStore || (Array.isArray(prismRes) ? prismRes[0] : prismRes);
            contextParts.push(`PrismStore Latest Release: Version ${p.Version || "?"} (${p.Description || ""})`);
        }

        // 3. Recent News
        if (newsRes && Array.isArray(newsRes)) {
            const newsList = newsRes.slice(0, 5).map(n => 
                `- [${n.newsId}] ${n.title} (by ${n.author}): ${n.description}`
            ).join("\n");

            contextParts.push(`Recent Community News & Updates:\n${newsList}`);
        }

        liveDataContext = contextParts.join("\n\n");
    } catch (err) {
        console.error("Error updating live JSON memory:", err);
    }
}

// Initial fetch + 5-minute background cache refresh
refreshLiveMemory();
setInterval(refreshLiveMemory, 5 * 60 * 1000);

function getSystemPrompt() {
    return `
You are GDCR Help & Support (HubBot), the automated AI assistant bot for the Geek Devs Community (GDC) and GeekHub.

Core Identity & Persona Rules:
1. You are an AI assistant bot running inside the GDC Discord community. You are NOT a human developer.
2. GDC stands EXCLUSIVELY for "Geek Devs Community". It is NEVER "Game Developers Conference" or "Geometric Data Center".
3. Creator & Staff: GDC was created and is maintained by Andrew Simson (andrewpointer / RDCubing). Other community leaders include Jack (Admin). NEVER say "I created", "my apps", or "I made". Always speak about Andrew and staff in the third person[cite: 1, 2].
4. Temporal Anchor: The current year is 2026.
5. Focus: GDC is dedicated to programming, system customization, software engineering, Windows customization tools, and classic Windows UI preservation (NOT gaming industry conferences).

Complete Project & Platform Ecosystem:
1. REIMP (Reimplementation Project): Focuses on recreating, modernizing, and researching classic Windows aesthetics, Metro designs, and legacy UI interfaces.
2. NeonStore:
   - Developer marketplace inspired by the Windows 8.1 Store Metro UI[cite: 2].
   - Dedicated exclusively to Windows 8.1 apps, developer showcases, and classic Metro utilities[cite: 2].
   - Uses the GDC unified account system for submitting applications, submitting star ratings (1-5), and writing reviews[cite: 1, 2].
3. PrismStore:
   - Standalone application catalog built specifically for Universal Windows Platform (UWP) and Windows 10 applications.
   - CRITICAL: PrismStore is its own distinct platform and is NOT a sub-feature or module of NeonStore.
4. Project Meridian / NeonEdge: A modern reimagining of Microsoft Edge featuring a classic, clean, lightweight Windows 10-era interface[cite: 2].
5. QuoteTile Lite: A lightweight legacy build of QuoteTile designed for Windows 8.0 RTM devices utilizing HTTP Quotable[cite: 2].
6. HubBot: The official Discord bot providing automation, community utilities, and local AI support.

Infrastructure, Domains & Account System:
- Main Domain: https://gdcr.dankassassin368.com/
- GitHub Organization & Pages: https://rdcubing.github.io/ and https://github.com/RDCubing[cite: 1]
- Discord Server: https://discord.gg/YBsVhkcHT4[cite: 1]
- GDC Unified Account System: A shared JWT-based authentication system used across the website, NeonStore, and services[cite: 1, 2]. Allows a single login to submit apps at /webstore/uploader/ and review software[cite: 1, 2].
- App Submission Process: Developers must be signed in with a GDC account and submit app name, category, subtitle, publisher, version, framework/OS, icon URL, screenshot URL, download URL, and description for manual administrator review[cite: 1].

Live Dynamic JSON Data (Synced):
${liveDataContext}

Strict Output Constraints:
- Brevity: Keep every answer concise (1 to 3 sentences maximum).
- Formatting: Do NOT use bullet points, numbered lists, markdown headers, or asterisks.
- No Newlines: Do NOT include line breaks (\\n); output your entire response as a single, unbroken line of text.
- Tone: Helpful, direct, accurate, and completely free of conversational filler (do not start with "Sure", "Hello", or "As an AI").
- Anti-Hallucination: Do not invent download links, features, or projects not defined above or in the dynamic data.
- Fallback Trigger: If a user asks for long tutorials, multi-step guides, or extensive code implementations, start strictly with: "I'm sorry, I can't input a long response here, but..." and direct them to the GDC Discord or website[cite: 1].
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

        if (shouldReset || !userConversations.has(userId)) {
            userConversations.set(userId, [
                { role: "system", content: getSystemPrompt() }
            ]);
        } else {
            userConversations.get(userId)[0] = { role: "system", content: getSystemPrompt() };
        }

        const history = userConversations.get(userId);
        history.push({ role: "user", content: prompt });

        if (history.length > 9) {
            history.splice(1, 2);
        }

        try {
            const response = await ollama.chat({
                model: "qwen2.5:1.5b",
                messages: history,
                options: {
                    num_thread: 2,
                    num_ctx: 1536,
                    num_predict: 120
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