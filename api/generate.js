const MODEL = "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI assistant dan builder untuk Roblox.

BAHASA:
- Bahasa default kamu adalah Bahasa Indonesia.
- Jika user menggunakan Bahasa Indonesia, jawab dalam Bahasa Indonesia.
- Jika user menggunakan Bahasa Inggris, jawab dalam Bahasa Inggris.
- Jika user menggunakan bahasa lain, usahakan mengikuti bahasa user.
- Jangan menerjemahkan pesan user kecuali diminta.
- Bahasa pada "message" harus mengikuti bahasa user.

KAMU BISA:
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
- Jawab secara natural.
- code harus string kosong.

JIKA USER MEMINTA SESUATU DIBUAT DI ROBLOX:
- Buat Luau yang valid.
- Code harus standalone.
- Code harus dapat dijalankan menggunakan loadstring() di server.
- message berisi penjelasan singkat.
- Buat hanya hal yang diminta user.
- Kamu boleh membuat objek pendukung jika memang diperlukan.

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
    let result = String(text || "").trim();

    result = result.replace(/^```json\s*/i, "");
    result = result.replace(/^```\s*/i, "");
    result = result.replace(/\s*```$/i, "");

    return result.trim();
}

async function askGemini(apiKey, prompt) {

    const controller = new AbortController();

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

                    thinkingConfig: {
                        thinkingLevel: "minimal"
                    },

                    maxOutputTokens: 4096
                }
            })
        });

        const body = await response.text();

        let data;

        try {

            data = JSON.parse(body);

        } catch {

            const error = new Error(
                `Response Gemini bukan JSON. HTTP ${response.status}`
            );

            error.status = response.status;

            throw error;
        }

        if (!response.ok) {

            const error = new Error(
                data?.error?.message ||
                `Gemini HTTP ${response.status}`
            );

            error.status = response.status;

            throw error;
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            const timeoutError = new Error(
                "Gemini timeout setelah 15 detik."
            );

            timeoutError.status = 504;

            throw timeoutError;
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
        process.env.GEMINI_API_KEY ||
        process.env.AI_API_KEY;

    if (!apiKey) {

        return res.status(500).json({
            error:
                "GEMINI_API_KEY belum dipasang di Vercel Environment Variables."
        });
    }

    // =========================
    // PROMPT
    // =========================

    let prompt = "";

    if (
        req.body &&
        typeof req.body.prompt === "string"
    ) {

        prompt = req.body.prompt;

    } else if (
        typeof req.body === "string"
    ) {

        try {

            const parsed =
                JSON.parse(req.body);

            if (
                typeof parsed?.prompt === "string"
            ) {
                prompt = parsed.prompt;
            }

        } catch {

            prompt = "";
        }
    }

    prompt = prompt.trim();

    if (!prompt) {

        return res.status(400).json({
            error: "Prompt kosong."
        });
    }

    // =========================
    // GEMINI
    // =========================

    try {

        let data;

        try {

            // Request pertama
            data = await askGemini(
                apiKey,
                prompt
            );

        } catch (firstError) {

            /*
             Retry hanya untuk error sementara.
             Tidak memakai 3x retry supaya Robild
             tidak terasa menggantung lama.
            */

            const retryable =
                [
                    429,
                    500,
                    502,
                    503,
                    504
                ].includes(
                    firstError.status
                );

            if (!retryable) {
                throw firstError;
            }

            await new Promise(resolve => {
                setTimeout(resolve, 300);
            });

            data = await askGemini(
                apiKey,
                prompt
            );
        }

        // =========================
        // AMBIL JAWABAN GEMINI
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

        } catch (error) {

            console.error(
                "[ROBILD] INVALID GEMINI JSON:",
                rawText
            );

            return res.status(502).json({
                error:
                    "Response Gemini bukan JSON valid."
            });
        }

        // =========================
        // VALIDASI HASIL
        // =========================

        const message =
            typeof result?.message === "string"
                ? result.message
                : "";

        const code =
            typeof result?.code === "string"
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

        return res.status(
            error.status || 500
        ).json({

            error:
                error.message ||
                "Robild gagal menghubungi Gemini."
        });
    }
};
