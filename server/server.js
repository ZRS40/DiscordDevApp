const express = require('express');
const client = require('../bot/bot.js');
const app = express();
const port = 3000;

app.use(express.json()); // Middleware to parse JSON bodies
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

app.get('/api/guilds/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
    }

    const roles = guild.roles.cache.map(role => {
        return { id: role.id, name: role.name, color: role.hexColor };
    }).sort((a, b) => b.position - a.position);

    const allChannels = guild.channels.cache;

    // Separate channels into categories and others
    const categories = allChannels
        .filter(c => c.type === 4 /* GuildCategory */)
        .map(c => ({ id: c.id, name: c.name, channels: [], position: c.rawPosition }))
        .sort((a, b) => a.position - b.position);

    const channelsWithoutCategory = [];

    allChannels
        .filter(c => c.type !== 4 /* GuildCategory */)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .forEach(channel => {
            const category = categories.find(c => c.id === channel.parentId);
            if (category) {
                category.channels.push({ id: channel.id, name: channel.name, type: channel.type });
            } else {
                channelsWithoutCategory.push({ id: channel.id, name: channel.name, type: channel.type });
            }
        });

    const structuredChannels = [...categories];
    if (channelsWithoutCategory.length > 0) {
        structuredChannels.push({
            id: null,
            name: 'No Category',
            channels: channelsWithoutCategory
        });
    }

    res.json({
        id: guild.id,
        name: guild.name,
        roles: roles,
        channels: structuredChannels
    });
});

// Create a new role
app.post('/api/guilds/:id/roles', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const { name, color, permissions } = req.body;
        const newRole = await guild.roles.create({
            name,
            color,
            permissions,
        });
        res.status(201).json(newRole);
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role', details: error.message });
    }
});

// Reorder roles
app.patch('/api/guilds/:id/roles', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        // req.body should be an array of { role: string (ID), position: number }
        const rolePositions = req.body;
        if (!Array.isArray(rolePositions)) {
            return res.status(400).json({ error: 'Request body must be an array of role positions.' });
        }

        await guild.roles.setPositions(rolePositions);
        res.json({ success: true, message: 'Roles reordered successfully.' });

    } catch (error) {
        console.error('Error reordering roles:', error);
        res.status(500).json({ error: 'Failed to reorder roles', details: error.message });
    }
});

// Edit a role
app.patch('/api/guilds/:id/roles/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const role = await guild.roles.fetch(req.params.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const { name, color, permissions } = req.body;
        const updatedRole = await role.edit({
            name,
            color,
            permissions,
        });
        res.json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role', details: error.message });
    }
});

// Delete a role
app.delete('/api/guilds/:id/roles/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const role = await guild.roles.fetch(req.params.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }
        await role.delete();
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Failed to delete role', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
