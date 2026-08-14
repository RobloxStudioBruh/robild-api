module.exports = async function (req, res) {

    // ==========================================
    // CORS
    // ==========================================

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }


    // ==========================================
    // MAIN
    // ==========================================

    try {

        console.log("[ROBILD] Request masuk");


        // ==========================================
        // API KEY
        // ==========================================

        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {

            console.error(
                "[ROBILD] AI_API_KEY tidak ditemukan"
            );

            return res.status(500).json({
                error:
                    "AI_API_KEY belum dipasang di Vercel."
            });
        }


        // ==========================================
        // PROMPT DARI ROBLOX
        // ==========================================

        const body = req.body || {};

        const prompt =
            typeof body.prompt === "string"
                ? body.prompt.trim()
                : "";


        if (!prompt) {

            return res.status(400).json({
                error: "Prompt kosong."
            });
        }


        console.log(
            "[ROBILD] Prompt:",
            prompt
        );


        // ==========================================
        // GEMINI MODEL
        // ==========================================

        const MODEL = "gemini-3.6-flash";

        const URL =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            MODEL +
            ":generateContent";


        // ==========================================
        // SYSTEM INSTRUCTION
        // ==========================================

        const systemPrompt = `
Kamu adalah Robild.

Robild adalah AI assistant yang berada di dalam game Roblox.

Robild mempunyai DUA kemampuan utama:

1. CHAT
2. MEMBUAT / MENGUBAH OBJECT DI ROBLOX

Kamu harus menentukan apakah permintaan pemain membutuhkan kode Roblox atau tidak.

========================================
CHAT
========================================

Kalau pemain hanya bertanya atau ngobrol:

Contoh:

"halo"
"siapa kamu?"
"apa itu Roblox?"
"jelaskan Vector3"
"berapa 2 + 2?"
"apa yang bisa kamu lakukan?"

Maka:

execute = false

Dan:

code = ""

Jawab pemain secara normal, ramah, jelas dan singkat.

========================================
BUILD / CODE
========================================

Kalau pemain meminta Robild membuat sesuatu di Roblox:

Contoh:

"buatkan part"
"buat balok"
"buat rumah"
"buat pohon"
"buat mobil"
"buat pedang"
"buat lantai"
"buat meja"
"buat script pintu otomatis"
"buat sistem teleport"
"buat NPC"
"buat model"

Maka:

execute = true

Dan code harus berisi Luau Roblox yang valid.

========================================
ATURAN KODE
========================================

Kode akan dijalankan oleh ServerScript Roblox.

Untuk object:

- Gunakan Instance.new
- Gunakan workspace
- Buat Model bernama AI_Build
- Parent Model ke workspace
- Semua BasePart harus Anchored = true
- Gunakan posisi sekitar Vector3.new(0, 10, 0)
- Masukkan object yang dibuat ke AI_Build
- Jangan menggunakan kode Markdown
- Jangan menggunakan ```lua
- Jangan menggunakan ``` 
- Jangan memberikan penjelasan di dalam code
- Code harus executable Luau

Contoh untuk "buatkan part":

local model = Instance.new("Model")
model.Name = "AI_Build"
model.Parent = workspace

local part = Instance.new("Part")
part.Name = "GeneratedPart"
part.Size = Vector3.new(6, 2, 6)
part.Position = Vector3.new(0, 10, 0)
part.Anchored = true
part.Parent = model

========================================
RESPON
========================================

Selalu kembalikan JSON dengan format:

{
  "reply": "jawaban untuk pemain",
  "execute": false,
  "code": ""
}

atau:

{
  "reply": "Penjelasan singkat tentang apa yang dibuat",
  "execute": true,
  "code": "KODE LUAU"
}

PENTING:

- reply adalah pesan yang akan muncul di chat Robild.
- execute menentukan apakah Roblox harus menjalankan code.
- code kosong jika tidak perlu menjalankan kode.
- Jangan masukkan Markdown.
- Jangan masukkan JSON di dalam string.
- Selalu berikan JSON valid.
`;


        // ==========================================
        // REQUEST GEMINI
        // ==========================================

        const response = await fetch(URL, {

            method: "POST",

            headers: {

                "Content-Type":
                    "application/json",

                "x-goog-api-key":
                    API_KEY

            },

            body: JSON.stringify({

                contents: [

                    {
                        role: "user",

                        parts: [

                            {
                                text:
                                    systemPrompt +
                                    "\n\nPLAYER REQUEST:\n" +
                                    prompt
                            }

                        ]
                    }

                ],

                generationConfig: {

                    responseMimeType:
                        "application/json"

                }

            })

        });


        // ==========================================
        // RESPONSE GEMINI
        // ==========================================

        const rawText =
            await response.text();


        console.log(
            "[ROBILD] Gemini status:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "[ROBILD] Gemini error:",
                rawText
            );

            return res.status(200).json({

                error:
                    "Gemini Error " +
                    response.status +
                    ": " +
                    rawText

            });
        }


        // ==========================================
        // PARSE RESPONSE
        // ==========================================

        let geminiData;

        try {

            geminiData =
                JSON.parse(rawText);

        } catch (err) {

            console.error(
                "[ROBILD] Response Gemini bukan JSON:",
                rawText
            );

            return res.status(200).json({

                error:
                    "Gemini mengirim response yang bukan JSON."

            });
        }


        // ==========================================
        // AMBIL TEXT GEMINI
        // ==========================================

        const candidate =
            geminiData
                ?.candidates
                ?.[
                    0
                ];

        const parts =
            candidate
                ?.content
                ?.parts || [];


        let aiText = "";

        for (
            const part
            of parts
        ) {

            if (
                part &&
                typeof part.text === "string"
            ) {

                aiText +=
                    part.text;

            }

        }


        aiText =
            aiText.trim();


        if (!aiText) {

            console.error(
                "[ROBILD] Gemini tidak memberikan text."
            );

            return res.status(200).json({

                error:
                    "Gemini tidak memberikan jawaban."

            });
        }


        // ==========================================
        // PARSE JSON HASIL AI
        // ==========================================

        let result;

        try {

            result =
                JSON.parse(aiText);

        } catch (err) {

            console.error(
                "[ROBILD] JSON AI invalid:",
                aiText
            );

            return res.status(200).json({

                error:
                    "Format jawaban Robild tidak valid.",

                raw:
                    aiText

            });
        }


        // ==========================================
        // VALIDASI
        // ==========================================

        const reply =
            typeof result.reply === "string"
                ? result.reply
                : "Sip bro!";

        const execute =
            result.execute === true;

        let code =
            typeof result.code === "string"
                ? result.code
                : "";


        // ==========================================
        // BERSIHKAN CODE
        // ==========================================

        code = code
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();


        // Kalau execute false,
        // jangan pernah mengirim code.

        if (!execute) {
            code = "";
        }


        // ==========================================
        // RESPONSE KE ROBLOX
        // ==========================================

        console.log(
            "[ROBILD] Execute:",
            execute
        );

        console.log(
            "[ROBILD] Code length:",
            code.length
        );


        return res.status(200).json({

            reply:
                reply,

            execute:
                execute,

            code:
                code

        });


    } catch (error) {

        // ==========================================
        // CRASH HANDLER
        // ==========================================

        console.error(
            "[ROBILD] SERVER ERROR:",
            error
        );

        return res.status(500).json({

            error:
                error?.message ||
                String(error)

        });

    }

};
