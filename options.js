(function () {
  const DEFAULTS = {
    apiKey: "",
    apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    modelName: "google/gemini-2.0-flash-001",
    selectivity: "medium"
  };

  async function load() {
    const data = await browser.storage.local.get(DEFAULTS);
    document.getElementById("apiKey").value = data.apiKey;
    document.getElementById("apiEndpoint").value = data.apiEndpoint;
    document.getElementById("modelName").value = data.modelName;
    document.getElementById("selectivity").value = data.selectivity;
  }

  document.getElementById("save").addEventListener("click", async () => {
    await browser.storage.local.set({
      apiKey: document.getElementById("apiKey").value.trim(),
      apiEndpoint:
        document.getElementById("apiEndpoint").value.trim() || DEFAULTS.apiEndpoint,
      modelName:
        document.getElementById("modelName").value.trim() || DEFAULTS.modelName,
      selectivity: document.getElementById("selectivity").value
    });
    const status = document.getElementById("status");
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  load();
})();
