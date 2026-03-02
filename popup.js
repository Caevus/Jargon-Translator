(function () {
  const DEFAULTS = { enableJargon: true, enableNotable: true };
  const IDS = Object.keys(DEFAULTS);

  async function load() {
    const data = await browser.storage.local.get(DEFAULTS);
    for (const id of IDS) {
      document.getElementById(id).checked = data[id];
    }
  }

  for (const id of IDS) {
    document.getElementById(id).addEventListener("change", (e) => {
      browser.storage.local.set({ [id]: e.target.checked });
    });
  }

  load();
})();
