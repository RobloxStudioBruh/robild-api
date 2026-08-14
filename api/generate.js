module.exports = async (req, res) => {
    // =========================
    // CORS
    // =========================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // OPTIONS / preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Hanya POST
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }

    try {
        // =========================
        // API KEY
        // =========================
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            return res.status(500).json({
                error: "AI_API_KEY tidak ditemukan di Vercel."
            });
        }

        // =========================
        // BODY
        // =========================
        const body = req.body || {};
        const prompt = body.prompt;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                error: "Prompt tidak ditemukan."
            });
        }

        // =========================
        // SYSTEM PROMPT ROBILD
        // =========================
        const systemPrompt = `
You are Robild, an AI assistant and Roblox Luau code generator.

You receive commands from a Roblox player.

If the player asks a normal question, answer normally.

If the player asks you to create or modify something in Roblox,
generate valid Roblox Luau code that performs the requested action.

For building requests:

1. Create a Model named AI_Build.
2. Parent AI_Build to workspace.
3. Put created objects inside AI_Build.
4. Every created BasePart must have Anchored = true.
5. Build around Vector3.new(0, 10, 0).
6. Use valid Roblox Luau.
7. Do not use fake APIs.
8. Do not use Markdown.
9. Do not use code fences.
10. Return only executable Luau code when the request is a Roblox building request.

Player request:
${prompt}
`;

        // =========================
        // GEMINI MODEL
        // =========================
        const MODEL = "gemini-3.6-flash";

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

        // =========================
        // REQUEST KE GEMINI
        // =========================
        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": API_KEY
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

        // =========================
        // BACA RESPONSE
        // =========================
        const data = await response.json();

        console.log("Gemini status:", response.status);

        // =========================
        // GEMINI ERROR
        // =========================
        if (!response.ok) {
            console.error(
                "Gemini API Error:",
                JSON.stringify(data)
            );

            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    "Gemini API Error."
            });
        }

        // =========================
        // AMBIL TEXT
        // =========================
        const parts =
            data?.candidates?.[0]?.content?.parts || [];

        const candidateText = parts
            .map(part => part?.text || "")
            .join("")
            .trim();

        if (!candidateText) {
            console.error(
                "Gemini tidak memberikan text:",
                JSON.stringify(data)
            );

            return res.status(500).json({
                error: "Gemini tidak mengembalikan jawaban."
            });
        }

        // =========================
        // BERSIHKAN MARKDOWN
        // =========================
        let result = candidateText
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // =========================
        // KIRIM KE ROBLOX
        // =========================
        return res.status(200).json({
            code: result,
            message: "Sip bro, udah gue buat!"
        });

    } catch (error) {

        console.error(
            "Robild API Error:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "Internal Server Error."
        });
    }
};
