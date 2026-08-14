const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({ error: "API Key belum dipasang di Vercel!" });
        }

        const systemPrompt = `You are a Roblox Luau code generator engine named Robild.
Task: Write valid, working Roblox Luau code to create 3D objects described in the user prompt in game.Workspace.
Rules:
1. Always group all created parts into an Instance.new('Model') named 'AI_Build' and parent it to Workspace.
2. Position the build near Vector3.new(0, 10, 0) or relative to workspace.
3. Always set Anchored = true for all created parts.
4. Output ONLY raw executable Luau code text. DO NOT wrap in markdown formatting (NO \`\`\`lua or \`\`\`), DO NOT add intro/outro comments or explanations.`;

        // Menggunakan endpoint gemini-2.0-flash
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
            {
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { text: `User Prompt: ${prompt}` }
                    ]
                }]
            }
        );

        let luauCode = response.data.candidates[0].content.parts[0].text;
        luauCode = luauCode.replace(/```lua/g, '').replace(/```/g, '').trim();

        return res.status(200).json({ code: luauCode });
    } catch (err) {
        console.error("Error Detail Gemini:", err.response ? err.response.data : err.message);
        return res.status(500).json({ error: "Gagal memproses AI" });
    }
};

