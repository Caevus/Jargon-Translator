const CONFIG = {
  DEFAULT_API_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",
  DEFAULT_MODEL: "google/gemini-2.0-flash-001",
  LLM_TEMPERATURE: 0.2
};

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

// Keyboard shortcut — same action as the context menu.
browser.commands.onCommand.addListener((command) => {
  if (command !== "translate-selection") return;
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { action: "translateJargon" });
    }
  });
});

// Handle messages from content scripts and extension pages.
browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── LLM proxy (avoids host-page CSP) ──────────────────────────────

  if (msg.action === "callLLM") {
    (async () => {
      const { apiKey, apiEndpoint, modelName } = await browser.storage.local.get({
        apiKey: "",
        apiEndpoint: CONFIG.DEFAULT_API_ENDPOINT,
        modelName: CONFIG.DEFAULT_MODEL
      });

      if (!apiKey) {
        sendResponse({
          error: {
            type: "ERR_NO_API_KEY",
            message: "No API key configured.",
            optionsUrl: browser.runtime.getURL("options.html")
          }
        });
        return;
      }

      try {
        let res;
        try {
          res = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: "user", content: msg.prompt }],
              temperature: CONFIG.LLM_TEMPERATURE
            })
          });
        } catch (fetchErr) {
          sendResponse({
            error: {
              type: "ERR_NETWORK",
              message: "Could not reach the API endpoint. Check your internet connection."
            }
          });
          return;
        }

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 401 || res.status === 403) {
            sendResponse({
              error: {
                type: "ERR_UNAUTHORIZED",
                message: "API key rejected (HTTP " + res.status + "). Check your key in Settings.",
                optionsUrl: browser.runtime.getURL("options.html")
              }
            });
          } else if (res.status === 429) {
            sendResponse({
              error: {
                type: "ERR_RATE_LIMITED",
                message: "Rate limit reached. Wait a moment and try again."
              }
            });
          } else if (res.status >= 500) {
            sendResponse({
              error: {
                type: "ERR_SERVER",
                message: "The AI server returned an error (HTTP " + res.status + "). Try again shortly."
              }
            });
          } else {
            sendResponse({
              error: {
                type: "ERR_HTTP",
                message: "LLM request failed (HTTP " + res.status + "): " + body
              }
            });
          }
          return;
        }

        const data = await res.json();
        const raw =
          data.choices &&
          data.choices[0] &&
          data.choices[0].message &&
          data.choices[0].message.content;

        if (!raw) {
          sendResponse({
            error: {
              type: "ERR_EMPTY",
              message: "The model returned an empty response. Try a different model in Settings.",
              optionsUrl: browser.runtime.getURL("options.html")
            }
          });
          return;
        }

        let parsed;
        try {
          const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          sendResponse({
            error: {
              type: "ERR_PARSE",
              message: "The model returned invalid JSON. Try a different model in Settings.",
              optionsUrl: browser.runtime.getURL("options.html")
            }
          });
          return;
        }

        sendResponse({ result: parsed });
      } catch (err) {
        sendResponse({
          error: {
            type: "ERR_NETWORK",
            message: err.message
          }
        });
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
          if (res.status === 404) {
            sendResponse({
              error:
                "Repository not found on GitHub. Make sure the repo is public and the homepage_url in manifest.json is correct."
            });
          } else if (res.status === 403) {
            sendResponse({
              error: "GitHub API rate limit exceeded. Try again in a few minutes."
            });
          } else {
            sendResponse({ error: `GitHub returned ${res.status}.` });
          }
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
