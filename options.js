(function () {
  const DEFAULTS = {
    apiKey: "",
    apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    modelName: "google/gemini-2.0-flash-001",
    jargonColor: "yellow",
    jargonCustomHex: "",
    notableColor: "blue",
    notableCustomHex: ""
  };

  // ── Color picker helpers ──────────────────────────────────────────

  function initColorRow(rowId) {
    const row = document.getElementById(rowId);
    const hexInput = row.querySelector(".hex-input");

    row.addEventListener("click", (e) => {
      const swatch = e.target.closest(".color-swatch");
      if (!swatch) return;
      row.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
      hexInput.classList.toggle("visible", swatch.dataset.color === "custom");
    });

    return {
      select(color) {
        row.querySelectorAll(".color-swatch").forEach((s) =>
          s.classList.toggle("selected", s.dataset.color === color)
        );
        hexInput.classList.toggle("visible", color === "custom");
      },
      selected() {
        const s = row.querySelector(".color-swatch.selected");
        return s ? s.dataset.color : "yellow";
      }
    };
  }

  const jargonPicker = initColorRow("jargonColorRow");
  const notablePicker = initColorRow("notableColorRow");

  // ── Load settings ─────────────────────────────────────────────────

  async function load() {
    const data = await browser.storage.local.get(DEFAULTS);
    document.getElementById("apiKey").value = data.apiKey;
    document.getElementById("apiEndpoint").value = data.apiEndpoint;
    document.getElementById("modelName").value = data.modelName;
    jargonPicker.select(data.jargonColor);
    document.getElementById("jargonCustomHex").value = data.jargonCustomHex;
    notablePicker.select(data.notableColor);
    document.getElementById("notableCustomHex").value = data.notableCustomHex;
  }

  // ── Save settings ─────────────────────────────────────────────────

  function showStatus(text, isError) {
    const el = document.getElementById("status");
    el.textContent = text;
    el.className = isError ? "status error" : "status";
    setTimeout(() => {
      el.textContent = "";
      el.className = "status";
    }, 2500);
  }

  document.getElementById("save").addEventListener("click", async () => {
    await browser.storage.local.set({
      apiKey: document.getElementById("apiKey").value.trim(),
      apiEndpoint:
        document.getElementById("apiEndpoint").value.trim() || DEFAULTS.apiEndpoint,
      modelName:
        document.getElementById("modelName").value.trim() || DEFAULTS.modelName,
      jargonColor: jargonPicker.selected(),
      jargonCustomHex: document.getElementById("jargonCustomHex").value.trim(),
      notableColor: notablePicker.selected(),
      notableCustomHex: document.getElementById("notableCustomHex").value.trim()
    });
    showStatus("Saved.");
  });

  // ── Export / Import ───────────────────────────────────────────────

  document.getElementById("exportBtn").addEventListener("click", async () => {
    const data = await browser.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jargon-translator-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });

  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await browser.storage.local.set(data);
      await load();
      showStatus("Settings imported.");
    } catch (err) {
      showStatus("Invalid settings file.", true);
    }
    e.target.value = "";
  });

  // ── Update check ──────────────────────────────────────────────────

  document.getElementById("checkUpdateBtn").addEventListener("click", async () => {
    const el = document.getElementById("updateStatus");
    el.textContent = "Checking\u2026";
    el.className = "update-status";
    try {
      const resp = await browser.runtime.sendMessage({ action: "checkForUpdates" });
      if (resp.error) {
        el.textContent = resp.error;
        return;
      }
      if (resp.updateAvailable) {
        el.textContent = "";
        el.appendChild(
          document.createTextNode(
            `v${resp.remoteVersion} available (you have v${resp.localVersion}). `
          )
        );
        const a = document.createElement("a");
        a.href = resp.repoUrl + "/archive/refs/heads/main.zip";
        a.target = "_blank";
        a.textContent = "Download ZIP";
        el.appendChild(a);
      } else {
        el.textContent = `Up to date (v${resp.localVersion}).`;
      }
    } catch (err) {
      el.textContent = "Could not check for updates.";
    }
  });

  load();
})();
