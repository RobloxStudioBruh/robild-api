const MODEL = "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI assistant dan builder di dalam Roblox.

Kamu menentukan sendiri jawaban berdasarkan pesan user.

Kamu bisa:
- ngobrol seperti AI assistant
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
- membuat dan mengubah objek Roblox

JANGAN:
- menggunakan jawaban hardcode
- selalu menjawab dengan kalimat yang sama
- menentukan jawaban hanya berdasarkan keyword
- meminta API key dari user
- menggunakan HTTP request dalam code Roblox
- menggunakan require() dengan asset ID yang tidak diketahui
- menghapus seluruh Workspace kecuali user meminta

Kamu sendiri menentukan apakah user membutuhkan code atau hanya jawaban.

JIKA USER HANYA BERTANYA / MENGOBROL:
- jawab natural
- code harus ""

JIKA USER MEMINTA SESUATU DIBUAT DI ROBLOX:
- buat Luau yang valid
- code harus standalone
- code harus dapat dijalankan oleh ServerScript menggunakan loadstring()
- message berisi jawaban natural dari Robild
- buat hanya hal yang diminta user
- jika diperlukan, kamu boleh membuat objek pendukung

ATURAN LUAU:
- Jangan gunakan markdown code fence.
- Jangan memasukkan penjelasan ke dalam code.
- Gunakan Instance.new() jika diperlukan.
- Berikan nama objek yang jelas.
- Untuk Part, gunakan property yang diperlukan seperti Size, Position, Anchored, Color, Material, dan Parent.
- Jangan membuat code yang membutuhkan API key.
- Jangan menggunakan HTTP request.
- Code harus aman untuk dijalankan di server Roblox.

BALAS HANYA DALAM JSON VALID.

FORMAT:

{
  "message": "jawaban Robild",
  "code": ""
}

JIKA PERLU MEMBUAT SESUATU:

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

    // Timeout 15 detik
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {

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
                "Gemini timeout setelah 15 detik."
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

    let prompt =
        req.body?.prompt;

    // Jika body dikirim sebagai string
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
    // GEMINI
    // =========================

    try {

        const data =
            await askGemini(
                apiKey,
                prompt.trim()
            );

        // =========================
        // AMBIL TEXT GEMINI
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

        const cleaned =
            cleanJSON(rawText);

        let result;

        try {

            result =
                JSON.parse(cleaned);

        } catch {

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
        // RESPONSE KE ROBLOX
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
                "Terjadi error saat menghubungi Gemini."

        });
    }
};
