browser.contextMenus.create({
  id: "translate-jargon",
  title: "Translate Jargon",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-jargon") {
    browser.tabs.sendMessage(tab.id, {
      action: "translateJargon",
      selectedText: info.selectionText
    });
  }
});

// Handle LLM API calls on behalf of content scripts.
// Content scripts are subject to the host page's CSP; background scripts are not.
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action !== "callLLM") return;

  (async () => {
    const { apiKey, apiEndpoint, modelName } = await browser.storage.local.get({
      apiKey: "",
      apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
      modelName: "google/gemini-2.0-flash-001"
    });

    if (!apiKey) {
      sendResponse({
        error:
          "No API key configured. Right-click the Jargon Translator icon → Preferences to set one."
      });
      return;
    }

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: msg.prompt }],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const body = await res.text();
        sendResponse({ error: `LLM request failed (${res.status}): ${body}` });
        return;
      }

      const data = await res.json();
      const raw =
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;

      if (!raw) {
        sendResponse({ error: "Empty response from LLM." });
        return;
      }

      const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
      sendResponse({ terms: JSON.parse(cleaned) });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  // Return true to keep the message channel open for the async response.
  return true;
});
