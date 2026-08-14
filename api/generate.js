const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI builder di dalam Roblox.

Kamu adalah AI yang bebas menentukan jawaban berdasarkan pesan user.

Kamu bisa:
- ngobrol seperti AI assistant biasa
- menjawab pertanyaan
- menjelaskan sesuatu
- membuat Part
- membuat Model
- membuat sistem Roblox
- membuat script Roblox
- membuat obby
- membuat UI
- membuat mekanik game
- mengubah atau membuat objek Roblox

PENTING:
Jangan menggunakan jawaban hardcode.
Jangan selalu menjawab dengan kalimat yang sama.
Jangan menentukan jawaban hanya berdasarkan keyword tertentu.

Jika user hanya ngobrol atau bertanya:
- jawab secara natural
- code harus ""

Jika user meminta sesuatu dibuat di Roblox:
- buat Lua/Luau code yang sesuai
- code harus bisa dijalankan oleh ServerScript Roblox
- message berisi penjelasan singkat

Kamu sendiri yang menentukan apakah permintaan membutuhkan code atau tidak.

ATURAN CODE:
- Gunakan Luau yang valid.
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Code harus standalone.
- Jangan menggunakan require() asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request.
- Jangan meminta API key.
- Jangan menghapus Workspace secara keseluruhan kecuali user memang meminta.
- Gunakan Instance.new() jika perlu membuat objek.
- Berikan nama objek yang jelas.
- Untuk Part, tentukan property yang diperlukan seperti Size, Position, Anchored, Color, Material, dan Parent.
- Code akan dijalankan menggunakan loadstring() di server.

BALAS HANYA JSON VALID:

{
  "message": "jawaban Robild",
  "code": ""
}

Jika perlu membuat sesuatu:

{
  "message": "penjelasan singkat",
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
    let result = text.trim();

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
                temperature: 0.7,
                responseMimeType: "application/json"
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

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

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

    const prompt = req.body?.prompt;

    if (
        typeof prompt !== "string" ||
        prompt.trim() === ""
    ) {

        return res.status(400).json({
            error: "Prompt kosong."
        });
    }

    // =========================
    // GEMINI REQUEST
    // =========================

    try {

        let data = null;
        let lastError = null;

        // Retry jika Gemini sedang overload
        for (let attempt = 0; attempt < 3; attempt++) {

            try {

                data = await askGemini(
                    apiKey,
                    prompt.trim()
                );

                break;

            } catch (error) {

                lastError = error;

                const retryable =
                    [429, 500, 502, 503, 504]
                        .includes(error.status);

                if (!retryable) {
                    throw error;
                }

                if (attempt < 2) {

                    await new Promise(resolve =>
                        setTimeout(
                            resolve,
                            1000 * (attempt + 1)
                        )
                    );
                }
            }
        }

        if (!data) {
            throw lastError ||
                new Error(
                    "Gemini tidak memberikan response."
                );
        }

        // =========================
        // AMBIL TEXT AI
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
                "[ROBILD] JSON GEMINI:",
                rawText
            );

            return res.status(502).json({
                error:
                    "Response Gemini bukan JSON valid.",
                raw: rawText
            });
        }

        // =========================
        // HASIL AI
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

        return res.status(
            error.status || 500
        ).json({
            error:
                error.message ||
                "Terjadi error pada server."
        });
    }
};
