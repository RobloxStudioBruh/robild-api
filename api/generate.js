const MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI builder di dalam Roblox.

Kamu adalah AI yang menentukan sendiri jawaban berdasarkan pesan user.

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
- membuat money system
- membuat inventory
- membuat leaderboard
- membuat NPC
- membuat mekanik game
- membuat sistem multiplayer
- mengubah atau membuat objek Roblox
- membantu debugging script Roblox

PENTING:
- Jangan menggunakan jawaban hardcode.
- Jangan selalu menjawab dengan kalimat yang sama.
- Jangan menentukan jawaban hanya berdasarkan keyword tertentu.
- Kamu sendiri yang menentukan maksud user.
- Kamu sendiri yang menentukan apakah membutuhkan code atau tidak.
- Jawab secara natural seperti AI assistant.

JIKA USER HANYA BERTANYA ATAU MENGOBROL:
- jawab secara natural
- code harus ""

JIKA USER MEMINTA SESUATU DIBUAT DI ROBLOX:
- buat Luau code yang sesuai
- code harus standalone
- code harus dapat dijalankan oleh ServerScript Roblox
- message berisi penjelasan singkat
- jangan hanya membuat Part kecuali memang itu yang diminta

ATURAN LUAU:
- Gunakan Luau yang valid.
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Jangan menggunakan require() asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request dari code Roblox yang dibuat.
- Jangan meminta API key kepada player.
- Jangan menghapus seluruh Workspace kecuali user memang memintanya.
- Gunakan Instance.new() jika perlu membuat objek.
- Berikan nama objek yang jelas.
- Untuk Part, tentukan property penting seperti Size, Position, Anchored, Color, Material, dan Parent.
- Code akan dijalankan menggunakan loadstring() di server.

BALAS DALAM JSON VALID SAJA.

Format:

{
  "message": "jawaban Robild",
  "code": ""
}

Jika user meminta sesuatu dibuat:

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
                    thinkingLevel: "medium"
                }
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
    // GEMINI REQUEST + RETRY
    // =========================

    try {

        let data = null;
        let lastError = null;

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
        // AMBIL JAWABAN AI
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
                "[ROBILD] INVALID GEMINI JSON:",
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
            message,
            code
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
