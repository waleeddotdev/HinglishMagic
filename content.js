let translatedCaptions = new Map();
let isApplyingCaptions = false;
let wordQueue = [];
let isProcessingWord = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "convertCaptions") {
        showStatus("Converting captions...", "loading");

        chrome.storage.local.get("geminiApiKey", async (data) => {
            if (!data.geminiApiKey) {
                showStatus("Missing API Key!", "error");
                return;
            }

            const apiKey = data.geminiApiKey;

            // Get captions using data-word-index (ignoring .css-1ptbncs)
            const captionElements = Array.from(document.querySelectorAll('[data-word-index]'))
                .filter(el => !el.classList.contains('css-1ptbncs')) // Ignore unwanted elements
                .map(el => ({
                    element: el, // Store reference for later update
                    text: el.children[1]?.textContent.trim() || "" // Get 2nd child text safely
                }));

            if (captionElements.length === 0) {
                showStatus("No captions found!", "error");
                return;
            }

            // Extract only the text to send for translation
            const captions = captionElements.map(el => el.text);

            try {
                // Send to Gemini API
                const translated = await fetchHinglishCaptions(apiKey, captions);
                if (!translated) {
                    showStatus("Translation failed!", "error");
                    return;
                }

                console.log("Translated captions:", translated);

                // Store the translated captions in the global Map for later use
                translatedCaptions = new Map();
                translated.forEach((item, index) => {
                    translatedCaptions.set(captions[index], item.text);
                });

                console.log("Translation map created:", translatedCaptions);

                showStatus("Conversion complete!", "success");
                sendResponse({ status: "success" });

            } catch (error) {
                console.error("Gemini API error:", error);
                showStatus("Failed to convert captions.", "error");
                sendResponse({ status: "error" });
            }
        });

        return true;
    } else if (message.action === "startApplyCaptions") {
        if (translatedCaptions.size === 0) {
            showStatus("No translations available!", "error");
            sendResponse({ status: "error" });
            return true;
        }

        isApplyingCaptions = true;
        startSequentialWordProcessing();
        showStatus("Started applying captions", "success");
        sendResponse({ status: "success" });
        return true;
    } else if (message.action === "endApplyCaptions") {
        isApplyingCaptions = false;
        wordQueue = [];
        isProcessingWord = false;
        showStatus("Stopped applying captions", "success");
        sendResponse({ status: "success" });
        return true;
    }
});

function startSequentialWordProcessing() {
    if (!isApplyingCaptions) return;

    // Reset the queue and processing state
    wordQueue = [];
    isProcessingWord = false;

    // Set up interval to check for visible words and process them one by one
    updateWordQueue();
    processNextWord();
}

function updateWordQueue() {
    if (!isApplyingCaptions) return;

    // Find all visible editable-word elements that have translations
    const editableWords = Array.from(document.querySelectorAll('.editable-word'))
        .filter(word => {
            // Check if the word is visible in the viewport
            const rect = word.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );

            if (!isVisible) return false;

            // Check if we have a translation for this word
            const originalText = word.textContent.trim();
            return translatedCaptions.has(originalText);
        });

    console.log("Found visible words to process:", editableWords.length);

    // Add new words to the queue if they're not already there
    editableWords.forEach(word => {
        if (!wordQueue.includes(word)) {
            wordQueue.push(word);
        }
    });

    // Schedule the next queue update
    setTimeout(updateWordQueue, 200);
}

function processNextWord() {
    if (!isApplyingCaptions || isProcessingWord || wordQueue.length === 0) {
        // If we're not applying, already processing, or queue is empty, schedule next check
        if (isApplyingCaptions) {
            setTimeout(processNextWord, 200);
        }
        return;
    }

    isProcessingWord = true;
    const word = wordQueue.shift();

    // Scroll the word into view at the top of the viewport
    word.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Wait for scroll to complete
    setTimeout(() => {
        const originalText = word.textContent.trim();
        console.log("Processing word:", originalText);

        if (translatedCaptions.has(originalText)) {
            const translatedText = translatedCaptions.get(originalText);
            console.log("Applying translation:", translatedText);

            // Apply the translation
            word.focus();
            document.execCommand("selectAll", false, null);
            document.execCommand("delete", false, null);

            setTimeout(() => {
                typeText(word, translatedText, () => {
                    // After typing is complete
                    showStatus(`Applied: ${translatedText}`, "info", 1000);

                    // Wait a bit before processing the next word
                    setTimeout(() => {
                        isProcessingWord = false;
                        processNextWord();
                    }, 50);
                });
            }, 100);
        } else {
            // No translation found, move to next word
            isProcessingWord = false;
            processNextWord();
        }
    }, 100); // Wait for scroll to complete
}

function typeText(element, text, callback) {
    let index = 0;

    function typeChar() {
        if (index < text.length) {
            const event = new InputEvent("input", { bubbles: true });
            element.innerText += text[index];
            element.dispatchEvent(event);

            index++;
            setTimeout(typeChar, 50);
        } else if (callback) {
            callback();
        }
    }

    typeChar();
}

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
       4. Return ONLY a valid JSON array of objects with "data-word-index" and "text".
       5. Example format: [{"data-word-index": "1", "text": "mera"}, {"data-word-index": "2", "text": "naam"}]
       6. Do NOT include any explanations, extra text, or formatting.

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

function showStatus(text, type, duration = 3000) {
    const statusDiv = document.createElement("div");
    statusDiv.innerText = text;
    statusDiv.style.position = "fixed";
    statusDiv.style.bottom = "20px";
    statusDiv.style.left = "20px";
    statusDiv.style.padding = "10px";
    statusDiv.style.background = type === "error" ? "red" :
        type === "success" ? "green" :
            type === "info" ? "blue" : "black";
    statusDiv.style.color = "white";
    statusDiv.style.fontSize = "14px";
    statusDiv.style.borderRadius = "5px";
    statusDiv.style.zIndex = "9999";
    document.body.appendChild(statusDiv);

    setTimeout(() => statusDiv.remove(), duration);
}