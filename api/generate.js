module.exports = async function (req, res) {
    // ==============================
    // CORS
    // ==============================
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

    // ==============================
    // SEMUA ERROR DITANGKAP
    // ==============================
    try {

        console.log("[ROBILD] Function started");

        // ==============================
        // API KEY
        // ==============================
        var API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            console.error("[ROBILD] AI_API_KEY tidak ditemukan");

            return res.status(200).json({
                code: "return",
                message: "❌ AI_API_KEY belum dipasang di Vercel."
            });
        }

        console.log("[ROBILD] API key ditemukan");

        // ==============================
        // BODY
        // ==============================
        var body = req.body;

        if (!body) {
            return res.status(200).json({
                code: "return",
                message: "❌ Request body kosong."
            });
        }

        var prompt = body.prompt;

        if (!prompt) {
            return res.status(200).json({
                code: "return",
                message: "❌ Prompt kosong."
            });
        }

        console.log("[ROBILD] Prompt:", prompt);

        // ==============================
        // GEMINI
        // ==============================
        var MODEL = "gemini-3.5-flash-lite";

        var URL =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            MODEL +
            ":generateContent";

        // ==============================
        // SYSTEM PROMPT
        // ==============================
        var systemPrompt = `
You are Robild, an AI assistant inside a Roblox game.

The player sends commands to you.

Player request:
${prompt}

Your job is to generate Roblox Luau code.

RULES:

1. Always return valid executable Roblox Luau.
2. Do not use Markdown.
3. Do not use code fences.
4. Do not explain the code.
5. Return ONLY Luau code.
6. If the player asks to create a Part, create it.
7. If the player asks to create multiple objects, create them.
8. Create a Model named AI_Build.
9. Parent AI_Build to workspace.
10. Put created objects inside AI_Build.
11. Every BasePart must have Anchored = true.
12. Build around Vector3.new(0, 10, 0).
13. Use only real Roblox Luau APIs.

If the player only says something like "test", return:

return
`;

        // ==============================
        // ABORT CONTROLLER
        // ==============================
        var controller = new AbortController();

        var timeout = setTimeout(function () {
            controller.abort();
        }, 8000);

        console.log("[ROBILD] Menghubungi Gemini...");

        // ==============================
        // REQUEST GEMINI
        // ==============================
        var geminiResponse;

        try {

            geminiResponse = await fetch(URL, {
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
                }),

                signal: controller.signal
            });

        } finally {

            clearTimeout(timeout);

        }

        console.log(
            "[ROBILD] Gemini HTTP:",
            geminiResponse.status
        );

        // ==============================
        // BACA RESPONSE
        // ==============================
        var rawText = await geminiResponse.text();

        console.log(
            "[ROBILD] Gemini response diterima"
        );

        var data;

        try {

            data = JSON.parse(rawText);

        } catch (jsonError) {

            console.error(
                "[ROBILD] Gemini mengirim response bukan JSON:",
                rawText
            );

            return res.status(200).json({
                code: "return",
                message:
                    "❌ Gemini mengirim response yang tidak valid."
            });
        }

        // ==============================
        // GEMINI ERROR
        // ==============================
        if (!geminiResponse.ok) {

            console.error(
                "[ROBILD] Gemini Error:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message:
                    "❌ Gemini Error " +
                    geminiResponse.status +
                    ": " +
                    (
                        data &&
                        data.error &&
                        data.error.message
                            ? data.error.message
                            : "Unknown Gemini error"
                    )
            });
        }

        // ==============================
        // AMBIL CANDIDATE
        // ==============================
        var candidate =
            data &&
            data.candidates &&
            data.candidates[0];

        if (!candidate) {

            console.error(
                "[ROBILD] Candidate tidak ditemukan:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message:
                    "❌ Gemini tidak mengembalikan candidate."
            });
        }

        // ==============================
        // AMBIL TEXT
        // ==============================
        var parts =
            candidate.content &&
            candidate.content.parts
                ? candidate.content.parts
                : [];

        var result = "";

        for (var i = 0; i < parts.length; i++) {

            if (
                parts[i] &&
                typeof parts[i].text === "string"
            ) {

                result += parts[i].text;
            }
        }

        result = result.trim();

        // ==============================
        // TIDAK ADA TEXT
        // ==============================
        if (!result) {

            console.error(
                "[ROBILD] Gemini tidak memberikan text:",
                JSON.stringify(data)
            );

            return res.status(200).json({
                code: "return",
                message:
                    "❌ Gemini tidak menghasilkan kode."
            });
        }

        // ==============================
        // BERSIHKAN MARKDOWN
        // ==============================
        result = result
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        // ==============================
        // SUKSES
        // ==============================
        console.log("[ROBILD] Gemini berhasil.");

        return res.status(200).json({
            code: result,
            message: "Robild berhasil memproses: " + prompt
        });

    } catch (error) {

        // ==============================
        // ERROR TERAKHIR
        // ==============================
        console.error(
            "[ROBILD] CRASH:",
            error
        );

        return res.status(200).json({
            code: "return",
            message:
                "❌ Robild API Error: " +
                (
                    error &&
                    error.message
                        ? error.message
                        : String(error)
                )
        });
    }
};
