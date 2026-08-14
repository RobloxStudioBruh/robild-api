module.exports = async (req, res) => {
    // =========================
    // CORS
    // =========================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Only POST allowed
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
                error: "AI_API_KEY belum dipasang di Vercel Environment Variables."
            });
        }

        // =========================
        // REQUEST BODY
        // =========================
        const body = req.body || {};
        const prompt = typeof body.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
            return res.status(400).json({
                error: "Prompt tidak boleh kosong."
            });
        }

        // =========================
        // SYSTEM PROMPT
        // =========================
        const systemPrompt = `
You are Robild, a Roblox Luau code generator.

Your task is to generate valid executable Roblox Luau code that creates 3D objects based on the user's request.

Rules:

1. Create a Model using Instance.new("Model").
2. The Model MUST be named "AI_Build".
3. Parent AI_Build to workspace.
4. All created Parts must be parented to AI_Build.
5. Every created BasePart must have Anchored = true.
6. Position the build around Vector3.new(0, 10, 0), unless another position is explicitly requested.
7. Use valid Roblox Luau APIs only.
8. Do not use fake Roblox APIs.
9. Do not use require() with external asset IDs.
10. Do not create scripts that execute arbitrary external code.
11. The output must be directly executable inside Roblox Studio.
12. Output ONLY raw Luau code.
13. Do NOT use Markdown.
14. Do NOT wrap the code in \`\`\`lua.
15. Do NOT explain the code.
16. Do NOT add introductory or ending text.

User request:
${prompt}
`;

        // =========================
        // GEMINI API
        // =========================
        const model = "gemini-3.6-flash";

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`;

        const response = await fetch(url, {
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

        // =========================
        // READ GOOGLE RESPONSE
        // =========================
        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);

            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    "Gemini API mengembalikan error.",
                status: response.status
            });
        }

        // =========================
        // GET GENERATED TEXT
        // =========================
        const candidate = data?.candidates?.[0];

        const parts = candidate?.content?.parts || [];

        const candidateText = parts
            .map(part => part?.text || "")
            .join("")
            .trim();

        if (!candidateText) {
            console.error("Empty Gemini response:", data);

            return res.status(500).json({
                error: "Gemini tidak mengembalikan kode Luau.",
                raw: data
            });
        }

        // =========================
        // CLEAN MARKDOWN
        // =========================
        let luauCode = candidateText
            .replace(/^```(?:lua|luau)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // =========================
        // RESPONSE
        // =========================
        return res.status(200).json({
            success: true,
            code: luauCode,
            message: "Sip bro, kode Roblox berhasil dibuat!"
        });

    } catch (err) {
        console.error("Server Error:", err);

        return res.status(500).json({
            error: err?.message || "Internal Server Error"
        });
    }
};
