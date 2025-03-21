chrome.runtime.onInstalled.addListener(() => {
    console.log("✅ Extension Installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`Received message: ${message.action}`);

    if (message.action === "convertCaptions" ||
        message.action === "startApplyCaptions" ||
        message.action === "endApplyCaptions") {

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0 || !tabs[0].url.includes("app.submagic.co")) {
                sendResponse({ status: "error", message: "⚠️ Open Submagic first!" });
                console.log("Tab not found or not Submagic");
                return;
            }

            // Execute content script if it hasn't been loaded yet
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            }, () => {
                console.log("Content script executed");

                // Forward the message to the content script
                chrome.tabs.sendMessage(tabs[0].id, message, sendResponse);
            });
        });

        return true;
    }
});
