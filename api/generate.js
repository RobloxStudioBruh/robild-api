module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method Not Allowed"
        });
    }

    try {
        const API_KEY = process.env.AI_API_KEY;

        if (!API_KEY) {
            return res.status(200).json({
                code: "return",
                message: "ERROR: AI_API_KEY belum dipasang di Vercel."
            });
        }

        const prompt = req.body?.prompt;

        if (!prompt) {
            return res.status(200).json({
                code: "return",
                message: "ERROR: Prompt kosong."
            });
        }

        const systemPrompt = `
You are Robild, an AI assistant inside Roblox.

The player request is:

${prompt}

If the player asks a normal question, return Luau code that does nothing:

return

If the player asks to create something in Roblox, create valid Roblox Luau code.

Rules:
- Use Roblox Luau.
- Create a Model named AI_Build.
- Parent it to workspace.
- Put created objects inside AI_Build.
- All BaseParts must be Anchored = true.
- Do not use markdown.
- Do not use ``` fences.
- Return ONLY executable Luau code.
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY
                },

                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: systemPrompt
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log(
            "GEMINI STATUS:",
            response.status
        );

        console.log(
            "GEMINI RESPONSE:",
            JSON.stringify(data)
        );

        if (!response.ok) {
            return res.status(200).json({
                code: "return",
                message:
                    "Gemini Error " +
                    response.status +
                    ": " +
                    (
                        data?.error?.message ||
                        "Unknown error"
                    )
            });
        }

        const text =
            data?.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

        if (!text) {
            return res.status(200).json({
                code: "return",
                message:
                    "Gemini tidak mengirim teks. Response: " +
                    JSON.stringify(data)
            });
        }

        const code = text
            .replace(/```luau/gi, "")
            .replace(/```lua/gi, "")
            .replace(/```/g, "")
            .trim();

        return res.status(200).json({
            code: code || "return",
            message: "Robild: " + prompt
        });

    } catch (error) {

        console.error(
            "GENERATE ERROR:",
            error
        );

        return res.status(200).json({
            code: "return",
            message:
                "Robild API Error: " +
                error.message
        });
    }
};
