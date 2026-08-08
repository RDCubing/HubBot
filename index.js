require("dotenv").config();



const fs = require("fs");

const path = require("path");

const express = require("express");

const {

    Client,

    Collection,

    GatewayIntentBits

} = require("discord.js");



/* -----------------------------

   CONFIGURATION

----------------------------- */



const PORT = Number(process.env.PORT) || 3001;

const HOST = process.env.HOST || "0.0.0.0";

const BASE_PATH = "/bot-status";



/* -----------------------------

   EXPRESS

----------------------------- */



const app = express();



/* Public bot-status page */



app.get(`${BASE_PATH}/`, (req, res) => {

    res.status(200).send(`

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <title>HubBot</title>

        </head>

        <body>

            <h1>HubBot</h1>

            <p>Bot is alive.</p>

        </body>

        </html>

    `);

});



/* Ping endpoint */



app.get(`${BASE_PATH}/ping`, (req, res) => {

    res.status(200).send("pong");

});



/* -----------------------------

   LOCAL ROOT / PING

----------------------------- */



app.get("/", (req, res) => {

    res.status(200).send("HubBot is alive.");

});



app.get("/ping", (req, res) => {

    res.status(200).send("pong");

});



/* -----------------------------

   CREATE BOT CLIENT

----------------------------- */



const client = new Client({

    intents: [GatewayIntentBits.Guilds]

});



/* -----------------------------

   COMMAND STORAGE

----------------------------- */



client.commands = new Collection();



/* -----------------------------

   LOAD COMMANDS

----------------------------- */



const commandsPath = path.join(__dirname, "commands");



const commandFiles = fs

    .readdirSync(commandsPath)

    .filter(file => file.endsWith(".js"));



for (const file of commandFiles) {

    const filePath = path.join(commandsPath, file);

    const command = require(filePath);



    if (!command.data || !command.execute) {

        console.log(`Skipping invalid command file: ${file}`);

        continue;

    }



    client.commands.set(command.data.name, command);

}



console.log(`Loaded ${client.commands.size} command(s).`);



/* -----------------------------

   STATUS ROTATION

----------------------------- */



const statuses = [

    "GDCR Community 👥",

    "Use /about",

    "Managing GeekHub apps"

];



let i = 0;



client.once("ready", () => {

    console.log(`Logged in as ${client.user.tag}`);



    client.user.setPresence({

        activities: [

            {

                name: statuses[i],

                type: 0

            }

        ],

        status: "online"

    });



    setInterval(() => {

        i = (i + 1) % statuses.length;



        client.user.setPresence({

            activities: [

                {

                    name: statuses[i],

                    type: 0

                }

            ],

            status: "online"

        });

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

            console.error(

                `Error executing /${interaction.commandName}:`,

                error

            );



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



        try {

            const customId = interaction.customId;



            const response = await fetch(

                "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/projects.json"

            );



            if (!response.ok) {

                throw new Error(

                    `projects.json returned HTTP ${response.status}`

                );

            }



            const data = await response.json();



            const allApps = [

                ...(data.NeonStore || []),

                ...(data.OtherPlatforms || [])

            ];



            const PAGE_SIZE = 5;



            const [type, direction, pageStr] = customId.split("_");



            let page = parseInt(pageStr, 10);



            if (Number.isNaN(page)) {

                return interaction.deferUpdate();

            }



            let list = allApps;



            if (type === "top") {

                list = allApps.filter(a => a.TopApp === "Yes");

            }



            const totalPages = Math.ceil(list.length / PAGE_SIZE);



            if (direction === "next") {

                page++;

            }



            if (direction === "prev") {

                page--;

            }



            if (page < 1 || page > totalPages) {

                return interaction.deferUpdate();

            }



            const start = (page - 1) * PAGE_SIZE;

            const items = list.slice(start, start + PAGE_SIZE);



            const format = items.map(app =>

                `**${app.Title}**

ID: ${app.Id}

Version: ${app.Version}`

            ).join("\n\n");



            return interaction.update({

                embeds: [

                    {

                        title: type === "top"

                            ? "Top Apps"

                            : "GeekHub App List",



                        color: 0x2b2d31,



                        description: format,



                        footer: {

                            text:

                                `Page ${page}/${totalPages} • ` +

                                `${list.length} apps`

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



        } catch (error) {

            console.error("Button interaction error:", error);



            if (!interaction.replied && !interaction.deferred) {

                await interaction.reply({

                    content: "Something went wrong while loading the apps.",

                    ephemeral: true

                });

            }

        }

    }

});



/* -----------------------------

   START WEB SERVER

----------------------------- */



const server = app.listen(PORT, HOST, () => {

    console.log(

        `Web server running at http://${HOST}:${PORT}`

    );

});



/* -----------------------------

   SERVER ERROR HANDLING

----------------------------- */



server.on("error", error => {

    console.error("Web server error:", error);



    if (error.code === "EADDRINUSE") {

        console.error(`Port ${PORT} is already in use.`);

    }



    process.exit(1);

});



/* -----------------------------

   DISCORD LOGIN

----------------------------- */



if (!process.env.TOKEN) {

    console.error(

        "ERROR: TOKEN is not set in the environment."

    );



    process.exit(1);

}



client.login(process.env.TOKEN).catch(error => {

    console.error(

        "Failed to log in to Discord:",

        error

    );



    process.exit(1);

});