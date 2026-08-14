// api/generate.js

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `
Kamu adalah Robild, AI builder yang berjalan di dalam Roblox.

Tugasmu:
1. Bisa ngobrol dan menjawab pertanyaan seperti chatbot AI biasa.
2. Bisa memahami perintah Roblox.
3. Jika user meminta membuat sesuatu di Roblox, buat Lua code yang bisa dijalankan oleh ServerScript Roblox.
4. Jika user hanya bertanya/ngobrol, JANGAN membuat kode.
5. Jangan menggunakan jawaban hardcode. Setiap jawaban harus kamu tentukan berdasarkan prompt user.

CONTOH:

User:
"halo"

Maka kamu boleh menjawab secara natural.
code harus "".

User:
"apa itu Part?"

Jelaskan apa itu Part.
code harus "".

User:
"buatkan Part"

Buat Lua code untuk membuat Part.
code harus berisi Lua yang dapat langsung dijalankan dengan loadstring().

User:
"buatkan obby"

Buat kode Lua untuk membuat obby sederhana.
code harus berisi Lua yang dapat langsung dijalankan.

User:
"buat sistem uang"

Buat kode Lua yang sesuai dengan permintaan user.

ATURAN KODE LUA:
- Kode harus executable Lua/Luau.
- Jangan memakai markdown code fence.
- Jangan memasukkan penjelasan ke dalam field code.
- Gunakan Instance.new, game:GetService(), workspace, Players, dll jika diperlukan.
- Jangan membuat LocalScript untuk sesuatu yang harus dijalankan server.
- Jangan menghapus seluruh Workspace kecuali user memang memintanya.
- Jangan membuat kode exploit.
- Jangan mencoba mencuri data, token, API key, password, atau informasi pribadi.
- Jika membuat objek, usahakan diberi nama yang jelas.
- Jika membuat Part, set ukuran, posisi, Anchored, dan properti lain yang diperlukan.
- Kode harus berdiri sendiri karena akan dijalankan melalui loadstring().
- Jangan menggunakan require() dari asset ID yang tidak diketahui.
- Jangan menggunakan HTTP request dari kode hasil AI.

BALAS HANYA DENGAN JSON VALID DENGAN FORMAT:

{
  "message": "jawaban untuk user",
  "code": ""
}

ATAU JIKA MEMBUAT SESUATU:

{
  "message": "penjelasan singkat tentang apa yang dibuat",
  "code": "kode Lua di sini"
}

Jangan tambahkan teks sebelum atau sesudah JSON.
`;

function extractText(data) {
    try {
        const parts = data?.candidates?.[0]?.content?.parts || [];

        return parts
            .filter(part => typeof part.text === "string")
            .map(part => part.text)
            .join("");
    } catch {
        return "";
    }
}

function cleanJSON(text) {
    let result = text.trim();

    // Kalau model masih memberikan ```json ... ```
    result = result.replace(/^```json\s*/i, "");
    result = result.replace(/^```\s*/i, "");
    result = result.replace(/\s*```$/i, "");

    return result.trim();
}

async function callGemini(apiKey, prompt) {
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
        throw new Error(
            `Gemini mengirim response bukan JSON. HTTP ${response.status}: ${body}`
        );
    }

    if (!response.ok) {
        const message =
            data?.error?.message ||
            `Gemini HTTP ${response.status}`;

        const error = new Error(message);
        error.status = response.status;

        throw error;
    }

    return data;
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method harus POST."
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: "GEMINI_API_KEY belum dipasang di Vercel Environment Variables."
        });
    }

    const prompt = req.body?.prompt;

    if (typeof prompt !== "string" || prompt.trim() === "") {
        return res.status(400).json({
            error: "Prompt kosong."
        });
    }

    try {
        // Retry kecil kalau Gemini sedang overload.
        let data;
        let lastError;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                data = await callGemini(apiKey, prompt.trim());
                break;
            } catch (error) {
                lastError = error;

                // Retry untuk 429 / 500 / 502 / 503 / 504
                if (![429, 500, 502, 503, 504].includes(error.status)) {
                    throw error;
                }

                if (attempt < 2) {
                    await new Promise(resolve =>
                        setTimeout(resolve, 800 * (attempt + 1))
                    );
                }
            }
        }

        if (!data) {
            throw lastError || new Error("Gemini tidak memberikan response.");
        }

        const rawText = extractText(data);

        if (!rawText) {
            return res.status(502).json({
                error: "Gemini tidak mengembalikan teks."
            });
        }

        const cleaned = cleanJSON(rawText);

        let result;

        try {
            result = JSON.parse(cleaned);
        } catch (error) {
            console.error("JSON DARI GEMINI:", rawText);

            return res.status(502).json({
                error: "Response Gemini bukan JSON yang valid.",
                raw: rawText
            });
        }

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
        console.error("ROBILD GEMINI ERROR:", error);

        return res.status(error.status || 500).json({
            error: error.message || "Terjadi error pada server."
        });
    }
};
