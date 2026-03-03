/**
 * colorUtils.js — shared color picker utilities used by popup.js and options.js.
 * Exposed as window.JT so both pages can reference the same logic without
 * duplicating it.
 */
(function () {
  "use strict";

  // Preset RGBA values used for the UI swatch dots (slightly opaque).
  const SWATCH_COLORS = {
    yellow: "rgba(255, 210, 50, 0.60)",
    blue:   "rgba(100, 160, 255, 0.55)",
    green:  "rgba(100, 200, 120, 0.55)",
    pink:   "rgba(255, 140, 170, 0.55)",
    purple: "rgba(180, 130, 255, 0.55)"
  };

  // Preset bg+border pairs used by the content script for highlight marks.
  const COLOR_PRESETS = {
    yellow: { bg: "rgba(255, 210, 50, 0.30)",  border: "rgba(180, 140, 0, 0.55)"   },
    blue:   { bg: "rgba(100, 160, 255, 0.25)", border: "rgba(40, 90, 200, 0.55)"   },
    green:  { bg: "rgba(100, 200, 120, 0.25)", border: "rgba(30, 130, 50, 0.55)"   },
    pink:   { bg: "rgba(255, 140, 170, 0.25)", border: "rgba(200, 60, 100, 0.55)"  },
    purple: { bg: "rgba(180, 130, 255, 0.25)", border: "rgba(100, 50, 200, 0.55)"  }
  };

  /** Convert a hex colour to the bg+border pair used for content highlights. */
  function hexToColors(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      bg:     `rgba(${r}, ${g}, ${b}, 0.25)`,
      border: `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, 0.55)`
    };
  }

  /** Convert a hex colour to a single RGBA string for UI swatch previews. */
  function hexToSwatch(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.55)`;
  }

  /**
   * Return the CSS background value for a swatch given the stored color name
   * and optional custom hex.  Falls back to yellow if name is unrecognised.
   */
  function swatchBg(colorName, customHex) {
    if (colorName === "custom" && /^#[0-9a-f]{3,6}$/i.test(customHex)) {
      return hexToSwatch(customHex);
    }
    return SWATCH_COLORS[colorName] || SWATCH_COLORS.yellow;
  }

  /**
   * Initialise a colour picker row.
   *
   * opts:
   *   rowId      — id of the container element
   *   dotSel     — CSS selector for clickable colour dots within the row
   *                (popup uses ".color-dot", options uses ".color-swatch")
   *   hexSel     — CSS selector for the hex text input within the row
   *   colorKey   — storage key for the chosen colour name
   *   hexKey     — storage key for the custom hex value
   *   swatchSel  — (optional) CSS selector for the swatch preview element
   *                outside the row (popup only)
   *
   * Returns { selectColor(name), selectedColor(), hexInput }.
   */
  function initColorPicker(opts) {
    const { rowId, dotSel, hexSel, colorKey, hexKey, swatchSel } = opts;
    const row = document.getElementById(rowId);
    const hexInput = row.querySelector(hexSel);

    function selectColor(colorName) {
      row.querySelectorAll(dotSel).forEach((d) =>
        d.classList.toggle("selected", d.dataset.color === colorName)
      );
      hexInput.classList.toggle("visible", colorName === "custom");

      if (swatchSel) {
        const swatchEl = document.querySelector(swatchSel);
        if (swatchEl) swatchEl.style.background = swatchBg(colorName, hexInput.value.trim());
      }
    }

    function selectedColor() {
      const el = row.querySelector(dotSel + ".selected");
      return el ? el.dataset.color : "yellow";
    }

    row.addEventListener("click", (e) => {
      const dot = e.target.closest(dotSel);
      if (!dot) return;
      selectColor(dot.dataset.color);
      browser.storage.local.set({ [colorKey]: dot.dataset.color });
    });

    hexInput.addEventListener("input", () => {
      const hex = hexInput.value.trim();
      if (/^#[0-9a-f]{3,6}$/i.test(hex)) {
        browser.storage.local.set({ [hexKey]: hex });
        if (swatchSel) {
          const swatchEl = document.querySelector(swatchSel);
          if (swatchEl) swatchEl.style.background = hexToSwatch(hex);
        }
      }
    });

    return { selectColor, selectedColor, hexInput };
  }

  // Expose on window so popup.js and options.js can access without ES modules.
  window.JT = { SWATCH_COLORS, COLOR_PRESETS, hexToColors, hexToSwatch, swatchBg, initColorPicker };
})();
