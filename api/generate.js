module.exports = async (req, res) => {
    // Set Header CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body || {};
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({ error: "API Key (AI_API_KEY) belum dipasang di Vercel!" });
        }

        const systemPrompt = `You are a Roblox Luau code generator engine named Robild.
Task: Write valid, working Roblox Luau code to create 3D objects described in the user prompt in game.Workspace.
Rules:
1. Always group all created parts into an Instance.new('Model') named 'AI_Build' and parent it to Workspace.
2. Position the build near Vector3.new(0, 10, 0) or relative to workspace.
3. Always set Anchored = true for all created parts.
4. Output ONLY raw executable Luau code text. DO NOT wrap in markdown formatting (NO \`\`\`lua or \`\`\`), DO NOT add intro/outro comments or explanations.`;

        // MENGGUNAKAN MODEL GEMINI 2.0 FLASH TERBARU
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `${systemPrompt}\n\nUser Request: ${prompt || 'buatkan part'}` }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "Google API Error" });
        }

        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
            return res.status(500).json({ error: "Gemini tidak mengembalikan teks kode." });
        }

        // Bersihkan formatting markdown jika ada
        let luauCode = candidateText.replace(/```lua/g, '').replace(/```/g, '').trim();

        return res.status(200).json({ code: luauCode, message: "Sip bro, udah gue buat ya!" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
