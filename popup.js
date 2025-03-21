document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKey");
    const convertButton = document.getElementById("convertCaptions");
    const startApplyButton = document.getElementById("startApply");
    const endApplyButton = document.getElementById("endApply");

    // Load saved API key if exists
    chrome.storage.local.get("geminiApiKey", (data) => {
        if (data.geminiApiKey) {
            apiKeyInput.value = data.geminiApiKey;
            console.log("Loaded API Key from storage:", data.geminiApiKey);
        }
    });

    // Save API key when input changes
    apiKeyInput.addEventListener("change", () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            chrome.storage.local.set({ geminiApiKey: key });
            console.log("API Key saved:", key);
        }
    });

    // Convert captions button
    convertButton.addEventListener("click", () => {
        // Save the API key first
        const key = apiKeyInput.value.trim();
        if (!key) {
            alert("Please enter a Gemini API Key first!");
            return;
        }

        chrome.storage.local.set({ geminiApiKey: key }, () => {
            console.log("API Key set for conversion:", key);
            // Send message to convert captions
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0].url.includes("app.submagic.co")) {
                    alert("⚠️ Please open Submagic first!");
                    console.error("Submagic not open in active tab");
                    return;
                }

                console.log("Sending message to convert captions");
                chrome.tabs.sendMessage(tabs[0].id, { action: "convertCaptions" });
            });
        });
    });

    // Start applying captions
    startApplyButton.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0].url.includes("app.submagic.co")) {
                alert("⚠️ Please open Submagic first!");
                console.error("Submagic not open in active tab");
                return;
            }

            // Hide start button, show end button
            startApplyButton.style.display = "none";
            endApplyButton.style.display = "block";
            console.log("Start applying captions");

            chrome.tabs.sendMessage(tabs[0].id, { action: "startApplyCaptions" });
        });
    });

    // End applying captions
    endApplyButton.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            // Show start button, hide end button
            startApplyButton.style.display = "block";
            endApplyButton.style.display = "none";
            console.log("End applying captions");

            chrome.tabs.sendMessage(tabs[0].id, { action: "endApplyCaptions" });
        });
    });
});
