let translatedCaptions = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "convertCaptions") {
        showStatus("Converting captions...", "loading");

        chrome.storage.local.get("geminiApiKey", async (data) => {
            if (!data.geminiApiKey) {
                showStatus("Missing API Key!", "error");
                return;
            }

            const apiKey = data.geminiApiKey;
            const captionElements = document.querySelectorAll(".content_editable_element");

            if (captionElements.length === 0) {
                showStatus("No captions found!", "error");
                return;
            }

            const captions = [...captionElements].map(el => el.innerText.trim());

            try {
                const translatedCaptions = await fetchHinglishCaptions(apiKey, captions);
                if (!translatedCaptions) {
                    showStatus("Translation failed!", "error");
                    return;
                }

                applyTranslatedCaptions(captionElements, translatedCaptions);

                showStatus("Conversion complete!", "success");
                sendResponse({ status: "success" });

            } catch (error) {
                console.error("Gemini API error:", error);
                showStatus("Failed to convert captions.", "error");
                sendResponse({ status: "error" });
            }
        });

        return true;
    }
});

async function fetchHinglishCaptions(apiKey, captions) {
    showStatus("Fetching Hinglish translations...", "loading");

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Convert the following Hindi captions to Hinglish transliteration. 
                               1. DO NOT change the number of words per line.
                               2. Keep English words unchanged.
                               3. If a line has 5 words, return exactly 5 words.
                               4. Return ONLY a valid JSON array (example: ["mera naam Waleed hai", "yeh ek test hai"]).
                               5. Do NOT include any explanations, extra text, or formatting.

                               Here are the captions:\n\n${JSON.stringify(captions)}`
                    }]
                }]
            })
        });

        const data = await response.json();
        return processGeminiResponse(data, captions);

    } catch (error) {
        showStatus("Error fetching translation!", "error");
        console.error("API Request Failed:", error);
        return null;
    }
}

function processGeminiResponse(data, captions) {
    try {
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text.trim();

        let jsonMatch = rawText.match(/\[.*?\]/s);
        if (!jsonMatch) throw new Error("Invalid JSON response");

        let convertedCaptions = JSON.parse(jsonMatch[0]);

        if (convertedCaptions.length !== captions.length) {
            showStatus("Caption count mismatch!", "error");
            return null;
        }

        return convertedCaptions;

    } catch (err) {
        showStatus("Gemini response invalid!", "error");
        console.error("Error parsing response:", err);
        return null;
    }
}

function applyTranslatedCaptions(captionElements, translatedCaptions) {
    captionElements.forEach((el, index) => {
        const newText = translatedCaptions[index] || "";

        el.focus();

        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);

        setTimeout(() => {
            typeText(el, newText);
        }, 300);
    });

    showStatus("Hinglish captions applied!", "success");
}

function typeText(element, text) {
    text.split("").forEach((char, index) => {
        setTimeout(() => {
            const event = new InputEvent("input", { bubbles: true });
            element.innerText += char;
            element.dispatchEvent(event);
        }, index * 30);
    });
}

function showStatus(text, type) {
    const statusDiv = document.createElement("div");
    statusDiv.innerText = text;
    statusDiv.style.position = "fixed";
    statusDiv.style.bottom = "20px";
    statusDiv.style.left = "20px";
    statusDiv.style.padding = "10px";
    statusDiv.style.background = type === "error" ? "red" : type === "success" ? "green" : "black";
    statusDiv.style.color = "white";
    statusDiv.style.fontSize = "14px";
    statusDiv.style.borderRadius = "5px";
    document.body.appendChild(statusDiv);

    setTimeout(() => statusDiv.remove(), 3000);
}
