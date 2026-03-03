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

// Handle messages from content scripts and extension pages.
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── LLM proxy (avoids host-page CSP) ──────────────────────────────

  if (msg.action === "callLLM") {
    (async () => {
      const { apiKey, apiEndpoint, modelName } = await browser.storage.local.get({
        apiKey: "",
        apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
        modelName: "google/gemini-2.0-flash-001"
      });

      if (!apiKey) {
        sendResponse({
          error:
            "No API key configured. Right-click the Jargon Translator icon \u2192 Preferences to set one."
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
    return true;
  }

  // ── Update check ──────────────────────────────────────────────────

  if (msg.action === "checkForUpdates") {
    (async () => {
      try {
        const manifest = browser.runtime.getManifest();
        const localVersion = manifest.version;
        const repoUrl =
          manifest.homepage_url || "https://github.com/Caevus/Jargon-Translator";
        const repoPath = new URL(repoUrl).pathname.slice(1);

        const res = await fetch(
          `https://api.github.com/repos/${repoPath}/contents/manifest.json`,
          { headers: { Accept: "application/vnd.github.v3+json" } }
        );

        if (!res.ok) {
          sendResponse({ error: `GitHub returned ${res.status}.` });
          return;
        }

        const data = await res.json();
        const remote = JSON.parse(atob(data.content));
        const remoteVersion = remote.version;

        // Simple semver comparison.
        const r = remoteVersion.split(".").map(Number);
        const l = localVersion.split(".").map(Number);
        let newer = false;
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
          if ((r[i] || 0) > (l[i] || 0)) { newer = true; break; }
          if ((r[i] || 0) < (l[i] || 0)) break;
        }

        sendResponse({ localVersion, remoteVersion, repoUrl, updateAvailable: newer });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
});
