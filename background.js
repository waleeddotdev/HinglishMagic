chrome.runtime.onInstalled.addListener(() => {
    console.log("✅ Extension Installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "convertCaptions") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0 || !tabs[0].url.includes("app.submagic.co")) {
                sendResponse({ status: "error", message: "⚠️ Open Submagic first!" });
                return;
            }

            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            }, () => {
                chrome.tabs.sendMessage(tabs[0].id, message, sendResponse);
            });
        });

        return true;
    }
});
