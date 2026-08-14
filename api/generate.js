module.exports = async (req, res) => {
    // ================================
    // CORS
    // ================================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Roblox/Vercel kadang melakukan OPTIONS
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Hanya menerima POST
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }

    try {
        // ================================
        // AMBIL PROMPT
        // ================================
        const body = req.body || {};
        const prompt = typeof body.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
            return res.status(400).json({
                error: "Prompt kosong."
            });
        }

        // ================================
        // API KEY
        // ================================
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({
                error: "AI_API_KEY belum dipasang di Vercel Environment Variables."
            });
        }

        // ================================
        // SYSTEM PROMPT ROBILD
        // ================================
        const systemPrompt = `
You are Robild, an AI assistant inside a Roblox game.

You have TWO main jobs:

1. CHAT
If the user asks a normal question, answer naturally and clearly.
You can explain Roblox, Lua, programming, game development, ideas, etc.

2. BUILD / CODE
If the user asks you to create something inside Roblox,
generate executable Roblox Luau code.

Examples:
- "buat part"
- "buat rumah"
- "buat pedang"
- "buat mobil"
- "buat pintu"
- "buat NPC"
- "buat sistem uang"
- "buat script"
- "buat obby"
- "buat map"

IMPORTANT RULES FOR BUILD REQUESTS:

- Return ONLY executable Luau code.
- Do NOT use markdown code fences.
- Do NOT write explanations before or after the code.
- The code must be compatible with Roblox Luau.
- Created objects should normally be placed in Workspace.
- Use Instance.new when creating Roblox instances.
- Anchor static building parts.
- Avoid deprecated Roblox APIs.
- Do not use require() with unknown asset IDs.
- Do not create malicious, destructive, or exploit code.
- Keep generated code self-contained whenever possible.

For BUILD requests, create a Model named "AI_Build"
and parent it to workspace.

For normal CHAT requests, return normal text.

The user request is:
${prompt}
        `.trim();

        // ================================
        // GEMINI MODEL
        // ================================
        //
        // Gemini 2.0 sudah shutdown.
        // Gunakan model yang masih aktif.
        //
        const model = "gemini-3.5-flash";

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`;

        // ================================
        // REQUEST KE GOOGLE
        // ================================
        const googleResponse = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: systemPrompt
                            }
                        ]
                    }
                ]
            })
        });

        // ================================
        // BACA RESPONSE
        // ================================
        const responseText = await googleResponse.text();

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Google returned non-JSON:", responseText);

            return res.status(502).json({
                error: "Google API mengembalikan response yang bukan JSON.",
                raw: responseText.slice(0, 1000)
            });
        }

        // ================================
        // GOOGLE ERROR
        // ================================
        if (!googleResponse.ok) {
            console.error(
                "Google API Error:",
                googleResponse.status,
                data
            );

            return res.status(googleResponse.status).json({
                error:
                    data?.error?.message ||
                    "Google Gemini API Error.",
                status: googleResponse.status
            });
        }

        // ================================
        // AMBIL TEXT GEMINI
        // ================================
        const candidate =
            data?.candidates?.[0];

        const parts =
            candidate?.content?.parts || [];

        const generatedText = parts
            .map(part => part?.text || "")
            .join("")
            .trim();

        // ================================
        // CEK RESPONSE KOSONG
        // ================================
        if (!generatedText) {
            console.error(
                "Gemini returned no text:",
                JSON.stringify(data)
            );

            return res.status(502).json({
                error: "Gemini tidak mengembalikan teks.",
                details: data
            });
        }

        // ================================
        // BERSIHKAN MARKDOWN
        // ================================
        let output = generatedText;

        output = output
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // ================================
        // DETEKSI BUILD / CODE
        // ================================
        const lowerPrompt = prompt.toLowerCase();

        const isBuildRequest =
            lowerPrompt.includes("buat part") ||
            lowerPrompt.includes("buatkan part") ||
            lowerPrompt.includes("buat rumah") ||
            lowerPrompt.includes("buatkan rumah") ||
            lowerPrompt.includes("buat mobil") ||
            lowerPrompt.includes("buatkan mobil") ||
            lowerPrompt.includes("buat pedang") ||
            lowerPrompt.includes("buatkan pedang") ||
            lowerPrompt.includes("buat pintu") ||
            lowerPrompt.includes("buatkan pintu") ||
            lowerPrompt.includes("buat npc") ||
            lowerPrompt.includes("buatkan npc") ||
            lowerPrompt.includes("buat map") ||
            lowerPrompt.includes("buatkan map") ||
            lowerPrompt.includes("buat obby") ||
            lowerPrompt.includes("buatkan obby") ||
            lowerPrompt.includes("buat script") ||
            lowerPrompt.includes("buatkan script");

        // ================================
        // RESPONSE KE ROBLOX
        // ================================
        return res.status(200).json({
            success: true,

            // Roblox ServerScript lu sekarang
            // membaca field "code".
            code: isBuildRequest ? output : "",

            // Ini yang ditampilkan di chat.
            message: output,

            // Informasi tambahan untuk debugging.
            type: isBuildRequest ? "code" : "chat",

            model: model
        });

    } catch (error) {

        // ================================
        // ERROR SERVER
        // ================================
        console.error("ROBILD API CRASH:", error);

        return res.status(500).json({
            error: "Robild API mengalami error internal.",
            details: error?.message || String(error)
        });
    }
};
