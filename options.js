(function () {
  const CONFIG = { STATUS_DISPLAY_MS: 2500 };

  const DEFAULTS = {
    apiKey: "",
    apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    modelName: "google/gemini-2.0-flash-001",
    jargonColor: "yellow",
    jargonCustomHex: "",
    notableColor: "blue",
    notableCustomHex: ""
  };

  // Model preset values that map to the <select> options in options.html.
  const MODEL_PRESETS = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5-8b",
    "meta-llama/llama-3.3-70b-instruct",
    "mistralai/mistral-7b-instruct",
    "qwen/qwen-2.5-7b-instruct:free"
  ];

  const modelPreset = document.getElementById("modelPreset");
  const modelCustom = document.getElementById("modelName");

  // Show/hide the custom model text input based on dropdown selection.
  modelPreset.addEventListener("change", () => {
    modelCustom.style.display = modelPreset.value === "custom" ? "" : "none";
  });

  /** Populate the model dropdown from a stored model name. */
  function setModelDropdown(storedModel) {
    if (MODEL_PRESETS.includes(storedModel)) {
      modelPreset.value = storedModel;
      modelCustom.style.display = "none";
    } else {
      modelPreset.value = "custom";
      modelCustom.value = storedModel;
      modelCustom.style.display = "";
    }
  }

  // ── Color pickers (shared logic lives in colorUtils.js / window.JT) ──────

  const jargonPicker = JT.initColorPicker({
    rowId:    "jargonColorRow",
    dotSel:   ".color-swatch",
    hexSel:   ".hex-input",
    colorKey: "jargonColor",
    hexKey:   "jargonCustomHex"
  });

  const notablePicker = JT.initColorPicker({
    rowId:    "notableColorRow",
    dotSel:   ".color-swatch",
    hexSel:   ".hex-input",
    colorKey: "notableColor",
    hexKey:   "notableCustomHex"
  });

  // ── Load settings ─────────────────────────────────────────────────────────

  async function load() {
    const data = await browser.storage.local.get(DEFAULTS);
    document.getElementById("apiKey").value      = data.apiKey;
    document.getElementById("apiEndpoint").value = data.apiEndpoint;
    setModelDropdown(data.modelName);
    jargonPicker.selectColor(data.jargonColor);
    document.getElementById("jargonCustomHex").value  = data.jargonCustomHex;
    notablePicker.selectColor(data.notableColor);
    document.getElementById("notableCustomHex").value = data.notableCustomHex;
  }

  // ── Save settings ─────────────────────────────────────────────────────────

  function showStatus(text, isError) {
    const el = document.getElementById("status");
    el.textContent = text;
    el.className = isError ? "status error" : "status";
    setTimeout(() => {
      el.textContent = "";
      el.className = "status";
    }, CONFIG.STATUS_DISPLAY_MS);
  }

  document.getElementById("save").addEventListener("click", async () => {
    const chosenModel =
      modelPreset.value === "custom"
        ? (modelCustom.value.trim() || DEFAULTS.modelName)
        : modelPreset.value;

    await browser.storage.local.set({
      apiKey:      document.getElementById("apiKey").value.trim(),
      apiEndpoint: document.getElementById("apiEndpoint").value.trim() || DEFAULTS.apiEndpoint,
      modelName:   chosenModel,
      jargonColor:      jargonPicker.selectedColor(),
      jargonCustomHex:  document.getElementById("jargonCustomHex").value.trim(),
      notableColor:     notablePicker.selectedColor(),
      notableCustomHex: document.getElementById("notableCustomHex").value.trim()
    });
    showStatus("Saved.");
  });

  // ── Export / Import ───────────────────────────────────────────────────────

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

  // ── Update check ──────────────────────────────────────────────────────────

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
        a.href = resp.repoUrl + "/releases/latest";
        a.target = "_blank";
        a.textContent = "View on GitHub";
        el.appendChild(a);
      } else {
        el.textContent = `Up to date (v${resp.localVersion}).`;
      }
    } catch (err) {
      el.textContent = "Could not check for updates.";
    }
  });

  load();

  // ── Keyboard shortcut customize link ──────────────────────────────────────

  document.getElementById("customizeShortcut").addEventListener("click", (e) => {
    e.preventDefault();
    browser.tabs.create({ url: "about:addons" });
  });
})();
