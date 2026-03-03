(function () {
  const DEFAULTS = { enableJargon: true, enableNotable: true };
  const IDS = Object.keys(DEFAULTS);

  const SWATCH_COLORS = {
    yellow: "rgba(255, 210, 50, 0.60)",
    blue: "rgba(100, 160, 255, 0.55)",
    green: "rgba(100, 200, 120, 0.55)",
    pink: "rgba(255, 140, 170, 0.55)",
    purple: "rgba(180, 130, 255, 0.55)"
  };

  function hexToSwatch(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.55)`;
  }

  function swatchBg(colorName, customHex) {
    if (colorName === "custom" && /^#[0-9a-f]{3,6}$/i.test(customHex)) {
      return hexToSwatch(customHex);
    }
    return SWATCH_COLORS[colorName] || SWATCH_COLORS.yellow;
  }

  // ── Color picker helpers ──────────────────────────────────────────

  // Map: row id → { storageColorKey, storageHexKey, swatchEl }
  const pickerConfig = {
    jargonColorRow:  { colorKey: "jargonColor",  hexKey: "jargonCustomHex",  swatchClass: ".swatch-jargon"  },
    notableColorRow: { colorKey: "notableColor", hexKey: "notableCustomHex", swatchClass: ".swatch-notable" }
  };

  function initPicker(rowId) {
    const row = document.getElementById(rowId);
    const cfg = pickerConfig[rowId];
    const hexInput = row.querySelector(".color-hex");

    // Select a preset dot and update the swatch + storage.
    function selectColor(colorName) {
      row.querySelectorAll(".color-dot").forEach((d) =>
        d.classList.toggle("selected", d.dataset.color === colorName)
      );
      hexInput.classList.toggle("visible", colorName === "custom");

      const swatch = document.querySelector(cfg.swatchClass);
      if (swatch) {
        swatch.style.background = swatchBg(
          colorName,
          hexInput.value.trim()
        );
      }
    }

    row.addEventListener("click", (e) => {
      const dot = e.target.closest(".color-dot");
      if (!dot) return;
      selectColor(dot.dataset.color);
      browser.storage.local.set({ [cfg.colorKey]: dot.dataset.color });
    });

    hexInput.addEventListener("input", () => {
      const hex = hexInput.value.trim();
      if (/^#[0-9a-f]{3,6}$/i.test(hex)) {
        browser.storage.local.set({ [cfg.hexKey]: hex });
        const swatch = document.querySelector(cfg.swatchClass);
        if (swatch) swatch.style.background = hexToSwatch(hex);
      }
    });

    return { selectColor, hexInput };
  }

  const pickers = {
    jargonColorRow: initPicker("jargonColorRow"),
    notableColorRow: initPicker("notableColorRow")
  };

  // ── Toggle swatch → open/close color row ──────────────────────────

  document.querySelectorAll(".swatch[data-picker]").forEach((sw) => {
    sw.addEventListener("click", () => {
      const row = document.getElementById(sw.dataset.picker);
      row.classList.toggle("open");
    });
  });

  // ── Load settings ─────────────────────────────────────────────────

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

    // Set swatch backgrounds.
    const jEl = document.querySelector(".swatch-jargon");
    const nEl = document.querySelector(".swatch-notable");
    if (jEl) jEl.style.background = swatchBg(data.jargonColor, data.jargonCustomHex);
    if (nEl) nEl.style.background = swatchBg(data.notableColor, data.notableCustomHex);

    // Sync picker dot selection + hex inputs.
    pickers.jargonColorRow.selectColor(data.jargonColor);
    pickers.jargonColorRow.hexInput.value = data.jargonCustomHex;
    pickers.notableColorRow.selectColor(data.notableColor);
    pickers.notableColorRow.hexInput.value = data.notableCustomHex;
  }

  // ── Enable/disable toggles ────────────────────────────────────────

  for (const id of IDS) {
    document.getElementById(id).addEventListener("change", (e) => {
      browser.storage.local.set({ [id]: e.target.checked });
    });
  }

  load();
})();
