(function () {
  const DEFAULTS = { enableJargon: true, enableNotable: true };
  const IDS = Object.keys(DEFAULTS);

  // ── Color pickers (shared logic lives in colorUtils.js / window.JT) ──────

  const pickers = {
    jargonColorRow: JT.initColorPicker({
      rowId:     "jargonColorRow",
      dotSel:    ".color-dot",
      hexSel:    ".color-hex",
      colorKey:  "jargonColor",
      hexKey:    "jargonCustomHex",
      swatchSel: ".swatch-jargon"
    }),
    notableColorRow: JT.initColorPicker({
      rowId:     "notableColorRow",
      dotSel:    ".color-dot",
      hexSel:    ".color-hex",
      colorKey:  "notableColor",
      hexKey:    "notableCustomHex",
      swatchSel: ".swatch-notable"
    })
  };

  // ── Toggle swatch → open/close color row ──────────────────────────────────

  document.querySelectorAll(".swatch[data-picker]").forEach((sw) => {
    sw.addEventListener("click", () => {
      const row = document.getElementById(sw.dataset.picker);
      row.classList.toggle("open");
    });
  });

  // ── Load settings ─────────────────────────────────────────────────────────

  async function load() {
    const data = await browser.storage.local.get({
      ...DEFAULTS,
      jargonColor: "yellow",
      jargonCustomHex: "",
      notableColor: "blue",
      notableCustomHex: ""
    });

    for (const id of IDS) {
      document.getElementById(id).checked = data[id];
    }

    const jEl = document.querySelector(".swatch-jargon");
    const nEl = document.querySelector(".swatch-notable");
    if (jEl) jEl.style.background = JT.swatchBg(data.jargonColor, data.jargonCustomHex);
    if (nEl) nEl.style.background = JT.swatchBg(data.notableColor, data.notableCustomHex);

    pickers.jargonColorRow.selectColor(data.jargonColor);
    pickers.jargonColorRow.hexInput.value = data.jargonCustomHex;
    pickers.notableColorRow.selectColor(data.notableColor);
    pickers.notableColorRow.hexInput.value = data.notableCustomHex;
  }

  // ── Enable/disable toggles ────────────────────────────────────────────────

  for (const id of IDS) {
    document.getElementById(id).addEventListener("change", (e) => {
      browser.storage.local.set({ [id]: e.target.checked });
    });
  }

  load();

  // ── Keyboard shortcut customize link ──────────────────────────────────────
  // Firefox blocks navigation to about: URLs from extension page <a> tags, so
  // we open the addons page programmatically instead.

  document.getElementById("customizeShortcut").addEventListener("click", (e) => {
    e.preventDefault();
    browser.tabs.create({ url: "about:addons" });
    window.close();
  });
})();
