const MODEL = "gemini-2.5-flash-lite";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI assistant dan builder untuk Roblox.

BAHASA:
- Bahasa default kamu adalah Bahasa Indonesia.
- Jika user menggunakan Bahasa Indonesia, jawab Bahasa Indonesia.
- Jika user menggunakan Bahasa Inggris, jawab Bahasa Inggris.
- Jika user menggunakan bahasa lain, usahakan mengikuti bahasa user.
- Jangan menerjemahkan pesan user kecuali diminta.
- Bahasa pada "message" harus mengikuti bahasa user.
- Kode tetap menggunakan Luau standar.

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
- membuat atau mengubah objek Roblox

PENTING:
- Jangan menggunakan jawaban hardcode.
- Jangan selalu menjawab dengan kalimat yang sama.
- Jangan menentukan jawaban hanya berdasarkan keyword.
- Kamu sendiri yang menentukan maksud user.
- Kamu sendiri yang menentukan apakah user membutuhkan code atau tidak.
- Jawab secara natural seperti AI assistant.

JIKA USER HANYA BERTANYA ATAU MENGOBROL:
- jawab secara natural
- code harus ""

JIKA USER MEMINTA SESUATU DIBUAT DI ROBLOX:
- buat Luau yang valid
- code harus standalone
- code harus dapat dijalankan menggunakan loadstring() di server
- message berisi jawaban singkat dan natural
- buat hanya apa yang diminta user
- boleh membuat objek pendukung jika memang diperlukan

ATURAN LUAU:
- Gunakan Luau yang valid.
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Jangan menggunakan require() dengan asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request.
- Jangan meminta API key.
- Jangan menghapus seluruh Workspace kecuali user memang memintanya.
- Gunakan Instance.new() bila diperlukan.
- Berikan nama objek yang jelas.
- Untuk Part, tentukan property penting seperti Size, Position, Anchored, Color, Material, dan Parent.
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
    return String(text || "")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

async function askGemini(apiKey, prompt) {

    const controller = new AbortController();

    // Jangan biarkan request menggantung terlalu lama.
    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {

        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },

            signal: controller.signal,

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

                    responseMimeType:
                        "application/json",

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

                    // 0 = tidak melakukan thinking.
                    // Cocok untuk mengejar response cepat.
                    thinkingConfig: {
                        thinkingBudget: 0
                    },

                    // Cukup untuk chat maupun script sederhana.
                    maxOutputTokens: 4096
                }
            })
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

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error(
                "Gemini timeout: response lebih dari 15 detik."
            );
        }

        throw error;

    } finally {

        clearTimeout(timeout);
    }
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

    const apiKey =
        process.env.AI_API_KEY;

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

            const parsed =
                JSON.parse(req.body);

            prompt =
                parsed?.prompt;

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
    // CALL GEMINI
    // =========================

    try {

        const data =
            await askGemini(
                apiKey,
                prompt.trim()
            );

        // =========================
        // AMBIL TEXT
        // =========================

        const rawText =
            getText(data);

        if (!rawText) {

            return res.status(502).json({
                error:
                    "Gemini tidak mengembalikan jawaban."
            });
        }

        // =========================
        // PARSE JSON
        // =========================

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
                    "Gemini mengembalikan JSON yang tidak valid."
            });
        }

        // =========================
        // MESSAGE
        // =========================

        const message =
            typeof result.message === "string"
                ? result.message
                : "";

        // =========================
        // CODE
        // =========================

        const code =
            typeof result.code === "string"
                ? result.code
                : "";

        // =========================
        // RESPONSE
        // =========================

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
                "Robild gagal menghubungi Gemini."
        });
    }
};
