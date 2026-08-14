module.exports = async function (req, res) {

    // ==============================
    // CORS
    // ==============================

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


    try {

        console.log("[ROBILD] Request masuk");


        // ==============================
        // API KEY
        // ==============================

        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {

            console.error(
                "[ROBILD] AI_API_KEY tidak ditemukan"
            );

            return res.status(200).json({
                code: "return",
                message: "❌ AI_API_KEY belum dipasang di Vercel."
            });
        }


        // ==============================
        // PROMPT
        // ==============================

        const body = req.body || {};

        const prompt =
            typeof body.prompt === "string"
                ? body.prompt.trim()
                : "";


        if (!prompt) {

            return res.status(200).json({
                code: "return",
                message: "❌ Prompt kosong, bro."
            });
        }


        console.log(
            "[ROBILD] Prompt:",
            prompt
        );


        // ==============================
        // GEMINI
        // ==============================

        const model = "gemini-2.5-flash";

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent";


        // ==============================
        // INSTRUKSI ROBILD
        // ==============================

        const instruction = `
Kamu adalah Robild, AI assistant di dalam game Roblox.

Kamu bisa melakukan dua hal:

1. Menjawab pertanyaan seperti chatbot AI.
2. Membuat sesuatu di Roblox menggunakan Luau.

PENTING:

Jika user hanya ngobrol atau bertanya:

Contoh:
- halo
- siapa kamu
- apa itu Roblox
- jelaskan Vector3
- bagaimana cara membuat game

Maka jangan membuat object.

Gunakan:

{
  "reply": "jawaban kamu",
  "execute": false,
  "code": ""
}

Jika user meminta membuat sesuatu di Roblox:

Contoh:
- buat part
- buat rumah
- buat meja
- buat pohon
- buat mobil
- buat pedang
- buat model
- buat sistem
- buat script

Gunakan:

{
  "reply": "penjelasan singkat",
  "execute": true,
  "code": "kode Luau"
}

ATURAN KODE:

- Gunakan Roblox Luau yang valid.
- Jangan gunakan Markdown.
- Jangan gunakan ```lua.
- Jangan gunakan ``` .
- Untuk object baru, buat Model bernama AI_Build.
- Parent AI_Build ke workspace.
- Masukkan object yang dibuat ke AI_Build.
- Semua BasePart harus Anchored = true.
- Gunakan posisi sekitar Vector3.new(0,10,0).
- Jangan membuat kode yang berbahaya.
- Jangan menghapus seluruh workspace.
- Jangan mengubah data penting game.
- Code harus langsung bisa dijalankan oleh loadstring Roblox.

CONTOH jika user mengatakan:

"buatkan part"

code harus kira-kira seperti:

local model = Instance.new("Model")
model.Name = "AI_Build"
model.Parent = workspace

local part = Instance.new("Part")
part.Name = "GeneratedPart"
part.Size = Vector3.new(6,2,6)
part.Position = Vector3.new(0,10,0)
part.Anchored = true
part.Parent = model

Kembalikan HANYA JSON valid.

Jangan memberikan teks di luar JSON.
`;


        // ==============================
        // REQUEST
        // ==============================

        const response = await fetch(url, {

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
                                text:
                                    instruction +
                                    "\n\nUSER:\n" +
                                    prompt
                            }

                        ]
                    }

                ],

                generationConfig: {

                    responseMimeType: "application/json"

                }

            })

        });


        // ==============================
        // RESPONSE GEMINI
        // ==============================

        const raw = await response.text();

        console.log(
            "[ROBILD] Gemini status:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "[ROBILD] Gemini ERROR:",
                raw
            );

            return res.status(200).json({

                code: "return",

                message:
                    "❌ Gemini Error " +
                    response.status +
                    ": " +
                    raw

            });
        }


        // ==============================
        // PARSE RESPONSE GEMINI
        // ==============================

        let gemini;

        try {

            gemini = JSON.parse(raw);

        } catch (error) {

            console.error(
                "[ROBILD] Gemini bukan JSON:",
                raw
            );

            return res.status(200).json({

                code: "return",

                message:
                    "❌ Response Gemini tidak valid."

            });
        }


        // ==============================
        // AMBIL TEXT
        // ==============================

        let aiText = "";

        if (
            gemini.candidates &&
            gemini.candidates[0] &&
            gemini.candidates[0].content &&
            gemini.candidates[0].content.parts
        ) {

            const parts =
                gemini.candidates[0].content.parts;

            for (let i = 0; i < parts.length; i++) {

                if (
                    parts[i] &&
                    typeof parts[i].text === "string"
                ) {

                    aiText += parts[i].text;

                }

            }

        }


        aiText = aiText.trim();


        if (!aiText) {

            console.error(
                "[ROBILD] Gemini tidak mengirim text:",
                raw
            );

            return res.status(200).json({

                code: "return",

                message:
                    "❌ Gemini tidak memberikan jawaban."

            });
        }


        // ==============================
        // PARSE JSON AI
        // ==============================

        let result;

        try {

            result = JSON.parse(aiText);

        } catch (error) {

            console.error(
                "[ROBILD] JSON AI error:",
                aiText
            );

            return res.status(200).json({

                code: "return",

                message:
                    aiText

            });
        }


        // ==============================
        // AMBIL JAWABAN
        // ==============================

        const reply =
            typeof result.reply === "string"
                ? result.reply
                : "Sip bro.";


        const execute =
            result.execute === true;


        let code =
            typeof result.code === "string"
                ? result.code
                : "";


        // ==============================
        // JIKA CUMA CHAT
        // ==============================

        if (!execute) {

            code = "return";

        }


        // ==============================
        // BERSIHKAN MARKDOWN
        // ==============================

        code = code
            .replace(/^```lua\s*/i, "")
            .replace(/^```luau\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();


        console.log(
            "[ROBILD] execute =",
            execute
        );

        console.log(
            "[ROBILD] code length =",
            code.length
        );


        // ==============================
        // KIRIM KE ROBLOX
        // ==============================

        return res.status(200).json({

            code: code,

            message: reply

        });


    } catch (error) {

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
