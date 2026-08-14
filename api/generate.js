module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

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
        // PROMPT
        // =========================
        const prompt = req.body?.prompt;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                error: "Prompt kosong atau tidak valid."
            });
        }

        // =========================
        // PROMPT ROBILD
        // =========================
        const systemPrompt = `
You are Robild, an AI inside a Roblox game.

The player can talk to you or ask you to create things in Roblox.

IMPORTANT:
You MUST always return executable Roblox Luau code.

If the player is only chatting, return valid Luau code that does nothing,
such as:

return

If the player asks to create something, generate the required Roblox Luau code.

Rules for building:

1. Create a Model named "AI_Build".
2. Parent the Model to workspace.
3. Put all created objects inside AI_Build.
4. Every BasePart must have Anchored = true.
5. Place the build around Vector3.new(0, 10, 0).
6. Use only real Roblox Luau APIs.
7. Do not use require() for external assets.
8. Do not use Markdown.
9. Do not use code fences.
10. Return ONLY executable Luau code.
11. Never return explanations outside the Luau code.

Player request:
${prompt}
`;

        // =========================
        // GEMINI
        // =========================
        const MODEL = "gemini-3.6-flash";

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

        const geminiResponse = await fetch(url, {
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
        const data = await geminiResponse.json();

        console.log(
            "Robild Gemini Status:",
            geminiResponse.status
        );

        // =========================
        // GEMINI ERROR
        // =========================
        if (!geminiResponse.ok) {

            console.error(
                "Gemini Error:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message:
                    "Gemini Error " +
                    geminiResponse.status +
                    ": " +
                    (
                        data?.error?.message ||
                        "Unknown Gemini error"
                    )
            });
        }

        // =========================
        // CEK CANDIDATE
        // =========================
        const candidate = data?.candidates?.[0];

        if (!candidate) {

            console.error(
                "Tidak ada candidate:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message: "Robild: Gemini tidak memberikan candidate."
            });
        }

        // =========================
        // CEK FINISH REASON
        // =========================
        if (
            candidate.finishReason &&
            candidate.finishReason !== "STOP"
        ) {

            console.warn(
                "Gemini Finish Reason:",
                candidate.finishReason
            );

            return res.status(200).json({
                code: "return",
                message:
                    "Robild tidak bisa menyelesaikan permintaan. " +
                    "Reason: " +
                    candidate.finishReason
            });
        }

        // =========================
        // AMBIL SEMUA TEXT PART
        // =========================
        const parts =
            candidate?.content?.parts || [];

        const textParts = parts
            .filter(part => typeof part?.text === "string")
            .map(part => part.text);

        const candidateText =
            textParts.join("\n").trim();

        // =========================
        // JIKA TIDAK ADA TEXT
        // =========================
        if (!candidateText) {

            console.error(
                "Gemini tidak mengembalikan text:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message:
                    "Robild: Gemini tidak mengembalikan teks."
            });
        }

        // =========================
        // BERSIHKAN MARKDOWN
        // =========================
        let luauCode = candidateText
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // =========================
        // PASTIKAN ADA CODE
        // =========================
        if (!luauCode) {
            luauCode = "return";
        }

        // =========================
        // RESPONSE KE ROBLOX
        // =========================
        return res.status(200).json({
            code: luauCode,
            message: "Robild selesai memproses: " + prompt
        });

    } catch (error) {

        console.error(
            "Robild generate.js ERROR:",
            error
        );

        // Tetap kasih JSON yang bisa dibaca Roblox
        return res.status(200).json({
            code: "return",
            message:
                "Robild API Error: " +
                (error?.message || "Unknown error")
        });
    }
};
