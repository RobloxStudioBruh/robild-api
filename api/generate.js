const MODEL = "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI assistant dan builder untuk Roblox.

Gunakan bahasa yang sama dengan user.
Jika user menggunakan Bahasa Indonesia, jawab Bahasa Indonesia.
Jika user menggunakan English, jawab English.

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
Jangan menentukan jawaban berdasarkan keyword tertentu.
Kamu sendiri yang menentukan apakah user membutuhkan code atau hanya jawaban.

Jika user hanya bertanya atau ngobrol:
- berikan jawaban natural
- code harus string kosong

Jika user meminta sesuatu dibuat di Roblox:
- buat Luau yang valid
- code harus standalone
- code harus dapat dijalankan menggunakan loadstring() di server
- message berisi penjelasan singkat
- buat hanya apa yang diminta user
- boleh membuat objek pendukung jika memang diperlukan

ATURAN LUAU:
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Jangan menggunakan require() dengan asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request.
- Jangan meminta API key.
- Jangan menghapus seluruh Workspace kecuali diminta.
- Gunakan Instance.new() bila diperlukan.
- Berikan nama objek yang jelas.
- Untuk Part, tentukan Size, Position, Anchored, Color, Material, dan Parent bila diperlukan.
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
    return (
        data?.candidates?.[0]?.content?.parts
            ?.filter(p => typeof p.text === "string")
            ?.map(p => p.text)
            ?.join("") || ""
    );
}

function cleanJSON(text) {
    return String(text || "")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

async function askGemini(apiKey, prompt) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 20000);

    try {

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
                    },

                    maxOutputTokens: 2048
                }

            }),

            signal: controller.signal
        });

        const body = await response.text();

        let data;

        try {
            data = JSON.parse(body);
        } catch {
            throw new Error(
                `Response Gemini bukan JSON. HTTP ${response.status}`
            );
        }

        if (!response.ok) {
            throw new Error(
                data?.error?.message ||
                `Gemini HTTP ${response.status}`
            );
        }

        return data;

    } finally {

        clearTimeout(timeout);

    }
}

module.exports = async (req, res) => {

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

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method harus POST."
        });
    }

    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error:
                "AI_API_KEY belum dipasang di Vercel Environment Variables."
        });
    }

    let prompt = req.body?.prompt;

    if (
        typeof prompt !== "string" &&
        typeof req.body === "string"
    ) {

        try {

            const parsed =
                JSON.parse(req.body);

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

    try {

        const data = await askGemini(
            apiKey,
            prompt.trim()
        );

        const rawText = getText(data);

        if (!rawText) {

            return res.status(502).json({
                error:
                    "Gemini tidak mengembalikan jawaban."
            });
        }

        let result;

        try {

            result =
                JSON.parse(
                    cleanJSON(rawText)
                );

        } catch {

            console.error(
                "[ROBILD] INVALID JSON:",
                rawText
            );

            return res.status(502).json({
                error:
                    "Response Gemini bukan JSON valid."
            });
        }

        return res.status(200).json({

            message:
                typeof result.message === "string"
                    ? result.message
                    : "",

            code:
                typeof result.code === "string"
                    ? result.code
                    : ""

        });

    } catch (error) {

        console.error(
            "[ROBILD] ERROR:",
            error
        );

        const message =
            error?.name === "AbortError"
                ? "Gemini terlalu lama merespons."
                : (
                    error?.message ||
                    "Terjadi error pada server."
                );

        return res.status(500).json({
            error: message
        });
    }
};
