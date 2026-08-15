const MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI assistant dan builder untuk Roblox.

Kamu bebas menentukan jawaban berdasarkan permintaan user.

Kamu bisa:
- ngobrol
- menjawab pertanyaan
- menjelaskan sesuatu
- membuat Part
- membuat Model
- membuat GUI
- membuat sistem money
- membuat inventory
- membuat leaderboard
- membuat NPC
- membuat obby
- membuat mekanik game
- membuat script Roblox
- membuat sistem multiplayer
- membantu debugging Roblox

Jangan menggunakan jawaban hardcode.
Jangan menentukan jawaban hanya berdasarkan keyword.
Kamu sendiri yang menentukan apakah user membutuhkan code atau hanya jawaban.

Jika user hanya bertanya atau ngobrol:
- berikan jawaban natural
- code harus berupa string kosong

Jika user meminta sesuatu dibuat di Roblox:
- buat Luau yang valid
- code harus standalone
- code harus dapat dijalankan menggunakan loadstring() di server
- message berisi penjelasan singkat
- buat hanya apa yang diminta user, tetapi kamu boleh membuat objek pendukung jika memang diperlukan

ATURAN LUAU:
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Jangan menggunakan require() dengan asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request.
- Jangan meminta API key.
- Jangan menghapus seluruh Workspace kecuali diminta.
- Gunakan Instance.new() bila diperlukan.
- Berikan nama objek yang jelas.
- Untuk Part, tentukan property yang diperlukan seperti Size, Position, Anchored, Color, Material, dan Parent.
- Code akan dijalankan di server Roblox.

BALAS HANYA DENGAN JSON VALID.

Format:

{
  "message": "jawaban natural dari Robild",
  "code": ""
}

Jika user meminta sesuatu dibuat:

{
  "message": "penjelasan singkat dari Robild",
  "code": "kode Luau"
}

Jangan menambahkan teks di luar JSON.
`;

function getText(data) {
    const parts =
        data?.candidates?.[0]?.content?.parts || [];

    return parts
        .filter(part => typeof part.text === "string")
        .map(part => part.text)
        .join("");
}

function cleanJSON(text) {
    let result = String(text || "").trim();

    result = result.replace(/^```json\s*/i, "");
    result = result.replace(/^```\s*/i, "");
    result = result.replace(/\s*```$/i, "");

    return result.trim();
}

async function askGemini(apiKey, prompt) {

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
            systemInstruction: {
                parts: [
                    {
                        text: SYSTEM_PROMPT
                    }
                ]
            },

            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],

            generationConfig: {
                responseMimeType: "application/json",

                responseSchema: {
                    type: "OBJECT",

                    properties: {
                        message: {
                            type: "STRING"
                        },

                        code: {
                            type: "STRING"
                        }
                    },

                    required: [
                        "message",
                        "code"
                    ]
                },

                thinkingConfig: {
                    thinkingLevel: "minimal"
                }
            }
        })
    });

    const body = await response.text();

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        throw new Error(
            `Response Gemini bukan JSON. HTTP ${response.status}: ${body}`
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            `Gemini HTTP ${response.status}`
        );
    }

    return data;
}

module.exports = async (req, res) => {

    // =========================
    // CORS
    // =========================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // =========================
    // OPTIONS
    // =========================

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    // =========================
    // METHOD
    // =========================

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method harus POST."
        });
    }

    // =========================
    // API KEY
    // =========================

    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error:
                "AI_API_KEY belum dipasang di Vercel Environment Variables."
        });
    }

    // =========================
    // PROMPT
    // =========================

    let prompt = req.body?.prompt;

    if (
        typeof prompt !== "string" &&
        typeof req.body === "string"
    ) {
        try {
            const parsed = JSON.parse(req.body);
            prompt = parsed?.prompt;
        } catch {
            prompt = "";
        }
    }

    if (
        typeof prompt !== "string" ||
        prompt.trim() === ""
    ) {
        return res.status(400).json({
            error: "Prompt kosong."
        });
    }

    // =========================
    // GEMINI
    // TANPA RETRY
    // =========================

    try {

        const data = await askGemini(
            apiKey,
            prompt.trim()
        );

        // =========================
        // AMBIL TEXT
        // =========================

        const rawText = getText(data);

        if (!rawText) {

            return res.status(502).json({
                error:
                    "Gemini tidak mengembalikan jawaban."
            });
        }

        // =========================
        // PARSE JSON
        // =========================

        const cleaned = cleanJSON(rawText);

        let result;

        try {

            result = JSON.parse(cleaned);

        } catch (error) {

            console.error(
                "[ROBILD] GEMINI RAW RESPONSE:",
                rawText
            );

            return res.status(502).json({
                error:
                    "Response Gemini bukan JSON valid."
            });
        }

        // =========================
        // HASIL ROBILD
        // =========================

        const message =
            typeof result.message === "string"
                ? result.message
                : "";

        const code =
            typeof result.code === "string"
                ? result.code
                : "";

        return res.status(200).json({
            message: message,
            code: code
        });

    } catch (error) {

        console.error(
            "[ROBILD] ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Terjadi error saat menghubungi Gemini."
        });
    }
};
