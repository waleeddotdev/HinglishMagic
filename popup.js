document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKey");
    const saveKeyButton = document.getElementById("saveKey");
    const convertButton = document.getElementById("convert");
    const statusText = document.getElementById("status");

    chrome.storage.local.get("geminiApiKey", (data) => {
        if (data.geminiApiKey) {
            apiKeyInput.value = data.geminiApiKey;
        }
    });

    saveKeyButton.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            chrome.storage.local.set({ geminiApiKey: key }, () => {
                alert("✅ API Key saved!");
            });
        }
    });

    convertButton.addEventListener("click", () => {
        statusText.textContent = "Fetching captions...";

        chrome.runtime.sendMessage({ action: "convertCaptions" }, (response) => {
            if (chrome.runtime.lastError) {
                statusText.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
            }

            if (response.status === "error") {
                statusText.textContent = response.message;
            } else {
                statusText.textContent = "Conversion complete!";
            }
        });
    });
});
