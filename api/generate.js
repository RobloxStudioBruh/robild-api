module.exports = async (req, res) => {
    // =========================
    // CORS
    // =========================
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
                error: "AI_API_KEY belum dipasang di Vercel."
            });
        }

        // =========================
        // PROMPT
        // =========================
        const { prompt } = req.body || {};

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                error: "Prompt kosong atau tidak valid."
            });
        }

        // =========================
        // SYSTEM PROMPT
        // =========================
        const systemPrompt = `
You are Robild, an AI Roblox Luau code generator.

The user will give you a command describing something they want created or changed in Roblox.

Your job is to generate valid executable Roblox Luau code.

Rules:
1. Create all generated objects inside a Model named "AI_Build".
2. AI_Build must be parented to workspace.
3. All created BaseParts must have Anchored = true.
4. Put the build around Vector3.new(0, 10, 0).
5. Use valid Roblox Luau syntax.
6. Do not use Markdown.
7. Do not use code fences.
8. Do not explain anything.
9. Return ONLY executable Luau code.

User request:
${prompt}
`;

        // =========================
        // GEMINI
        // =========================

        // Ganti bagian MODEL ini jika menggunakan
        // model Gemini lain yang tersedia di project/API key lu.
        const MODEL = "gemini-2.5-flash";

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            MODEL +
            ":generateContent?key=" +
            encodeURIComponent(API_KEY);

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

        const data = await response.json();

        // =========================
        // GEMINI ERROR
        // =========================
        if (!response.ok) {
            console.error("Gemini API Error:", data);

            return res.status(response.status).json({
                error:
                    data?.error?.message ||
                    "Gemini API Error"
            });
        }

        // =========================
        // AMBIL HASIL GEMINI
        // =========================
        const candidateText =
            data?.candidates?.[0]?.content?.parts
                ?.map(part => part?.text || "")
                .join("")
                .trim();

        if (!candidateText) {
            console.error("Gemini tidak mengembalikan text:", data);

            return res.status(500).json({
                error: "Gemini tidak mengembalikan kode."
            });
        }

        // =========================
        // BERSIHKAN CODE FENCE
        // =========================
        let luauCode = candidateText
            .replace(/^```(?:lua|luau)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // =========================
        // RESPONSE
        // =========================
        return res.status(200).json({
            code: luauCode,
            message: "Sip bro, udah gue buat ya!"
        });

    } catch (err) {

        console.error("generate.js error:", err);

        return res.status(500).json({
            error: err?.message || "Internal Server Error"
        });
    }
};
