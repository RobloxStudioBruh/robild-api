const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;
        const apiKey = process.env.AI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API Key AI_API_KEY belum dipasang di Vercel!" });
        }

        // Inisialisasi SDK resmi Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `You are a Roblox Luau code generator engine named Robild.
Task: Write valid, working Roblox Luau code to create 3D objects described in the user prompt in game.Workspace.
Rules:
1. Always group all created parts into an Instance.new('Model') named 'AI_Build' and parent it to Workspace.
2. Position the build near Vector3.new(0, 10, 0) or relative to workspace.
3. Always set Anchored = true for all created parts.
4. Output ONLY raw executable Luau code text. DO NOT wrap in markdown formatting (NO \`\`\`lua or \`\`\`), DO NOT add intro/outro comments or explanations.`
        });

        // Generate konten
        const result = await model.generateContent(prompt || "buatkan part");
        const responseText = result.response.text();

        // Bersihkan formatting markdown jika ada
        let luauCode = responseText.replace(/```lua/g, '').replace(/```/g, '').trim();

        return res.status(200).json({ code: luauCode });
    } catch (err) {
        console.error("Error SDK Gemini:", err);
        // Kirim detail error aslinya ke Roblox biar ketahuan
        return res.status(500).json({ error: "Gagal AI: " + err.message });
    }
};
