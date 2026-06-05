require("dotenv").config();

const fs = require("fs");
const {
    Client,
    Collection,
    GatewayIntentBits
} = require("discord.js");

// Create bot client
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Command storage
client.commands = new Collection();

/* -----------------------------
   LOAD COMMANDS
----------------------------- */
const commandFiles = fs
    .readdirSync("./commands")
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    if (!command.data || !command.execute) {
        console.log(`Skipping invalid command file: ${file}`);
        continue;
    }

    client.commands.set(command.data.name, command);
}

/* -----------------------------
   STATUS ROTATION
----------------------------- */
const statuses = [
    "GDCR Community 👥",
    "Use /help",
    "Managing GeekHub apps"
];

let i = 0;

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);

    setInterval(() => {
        client.user.setPresence({
            activities: [
                {
                    name: statuses[i],
                    type: 0
                }
            ],
            status: "online"
        });

        i = (i + 1) % statuses.length;
    }, 10000);
});

/* -----------------------------
   INTERACTIONS
----------------------------- */
client.on("interactionCreate", async interaction => {

    /* -------------------------
       SLASH COMMANDS
    ------------------------- */
    if (interaction.isChatInputCommand()) {

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            return interaction.reply({
                content: "Command not found.",
                ephemeral: true
            });
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);

            const msg = {
                content: "Error running command.",
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg);
            } else {
                await interaction.reply(msg);
            }
        }
    }

    /* -------------------------
       BUTTON PAGINATION
    ------------------------- */
    if (interaction.isButton()) {

        const customId = interaction.customId;

        const res = await fetch(
            "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/projects.json"
        );

        const data = await res.json();

        const allApps = [
            ...(data.NeonStore || []),
            ...(data.OtherPlatforms || [])
        ];

        const PAGE_SIZE = 5;

        const [type, direction, pageStr] = customId.split("_");

        let page = parseInt(pageStr);

        let list = allApps;

        if (type === "top") {
            list = allApps.filter(a => a.TopApp === "Yes");
        }

        const totalPages = Math.ceil(list.length / PAGE_SIZE);

        if (direction === "next") page++;
        if (direction === "prev") page--;

        if (page < 1 || page > totalPages) {
            return interaction.deferUpdate();
        }

        const start = (page - 1) * PAGE_SIZE;
        const items = list.slice(start, start + PAGE_SIZE);

        // ⭐ BOLD TITLES ADDED HERE
        const format = items.map(app =>
            `**${app.Title}**
ID: ${app.Id}
Version: ${app.Version}`
        ).join("\n\n");

        return interaction.update({
            embeds: [
                {
                    title: type === "top" ? "Top Apps" : "GeekHub App List",
                    color: 0x2b2d31,
                    description: format,
                    footer: {
                        text: `Page ${page}/${totalPages} • ${list.length} apps`
                    }
                }
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 1,
                            label: "Previous",
                            custom_id: `${type}_prev_${page}`,
                            disabled: page === 1
                        },
                        {
                            type: 2,
                            style: 1,
                            label: "Next",
                            custom_id: `${type}_next_${page}`,
                            disabled: page === totalPages
                        }
                    ]
                }
            ]
        });
    }
});

/* -----------------------------
   LOGIN
----------------------------- */
client.login(process.env.TOKEN);