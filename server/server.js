const express = require('express');
const client = require('../bot/bot.js');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/api/guilds', (req, res) => {
    const guilds = client.guilds.cache.map(guild => {
        return {
            id: guild.id,
            name: guild.name
        };
    });
    res.json(guilds);
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
