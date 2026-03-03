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
    if (jEl) jEl.style.background = swatchBg(data.jargonColor, data.jargonCustomHex);
    if (nEl) nEl.style.background = swatchBg(data.notableColor, data.notableCustomHex);
  }

  for (const id of IDS) {
    document.getElementById(id).addEventListener("change", (e) => {
      browser.storage.local.set({ [id]: e.target.checked });
    });
  }

  load();
})();
