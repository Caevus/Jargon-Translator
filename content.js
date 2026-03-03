(function () {
  "use strict";

  // ── Configuration ─────────────────────────────────────────────────────────
  // All tuneable constants in one place.

  const CONFIG = {
    CONTEXT_CHARS: 800,       // characters of surrounding text sent for context
    CONTEXT_FALLBACK_CHARS: 1600, // fallback when selection can't be found in container
    DEBOUNCE_MS: 500,         // delay before firing LLM after a new selection
    BRIEF_DISPLAY_MS: 3000,   // how long "No results found." stays visible
    ERROR_DISPLAY_MS: 5000,   // how long error tooltips stay visible
    TOOLTIP_GAP_PX: 6,        // gap between tooltip and highlighted term
    TOOLTIP_MARGIN_PX: 4,     // minimum distance from viewport edge
    LOADING_GAP_PX: 6         // gap between loading indicator and selection
  };

  const JARGON_CLASS  = "jt-highlight";
  const NOTABLE_CLASS = "jt-notable";
  const TOOLTIP_CLASS = "jt-tooltip";
  const LOADING_CLASS = "jt-loading";

  // ── Common-terms blocklist ────────────────────────────────────────────────
  // Terms that the LLM is told to skip but sometimes flags anyway.  Post-filter
  // results against this set, and skip the API call entirely when EVERY token
  // in the selection is listed here.

  const COMMON_TERMS_BLOCKLIST = new Set([
    // Consumer electronics & connectivity
    "tv", "dvd", "hdtv", "lcd", "led", "oled", "4k", "usb", "hdmi", "wifi",
    "wi-fi", "bluetooth", "gps", "nfc", "rf", "ir", "vr", "ar",
    // Files & formats
    "pdf", "jpeg", "jpg", "png", "gif", "mp3", "mp4", "csv", "zip", "doc",
    "docx", "xls", "xlsx", "ppt", "html", "css", "xml", "json",
    // Communication & internet
    "email", "e-mail", "sms", "mms", "dm", "url", "www", "http", "https",
    "ftp", "app", "chat", "forum", "blog", "vlog", "rss", "spam",
    // Universal abbreviations
    "atm", "asap", "fyi", "aka", "diy", "faq", "eta", "rsvp", "tba", "tbd",
    "tbc", "ps", "re", "cc", "bcc", "id", "pin", "otc", "ngo",
    // Business basics
    "ceo", "cfo", "cto", "coo", "hr", "pr", "qa", "cv", "kpi", "roi",
    "b2b", "b2c", "ipo",
    // Units of measure
    "km", "mi", "mph", "kph", "kg", "lb", "lbs", "mg", "ml", "gb", "mb",
    "kb", "tb", "ghz", "mhz", "hz", "kwh", "psi", "rpm",
    // Time & geography
    "am", "pm", "est", "cst", "mst", "pst", "gmt", "utc", "bst",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    // Common tech/computing words that aren't jargon in context
    "pc", "mac", "os", "io", "api", "sdk", "ide", "ui", "ux",
    // Medical/everyday
    "iq", "bmi", "dna", "rna", "er", "icu", "gp",
    // Misc
    "ok", "okay", "etc", "vs", "no", "yes",
    // Common English words with technical origins — universally understood
    "acronym", "algorithm", "data", "server", "network", "digital", "software",
    "hardware", "browser", "download", "upload", "online", "offline", "database",
    "update", "virus", "bandwidth", "internet", "website", "pixel", "router",
    "modem", "laptop", "desktop", "tablet", "smartphone", "hashtag", "selfie",
    "podcast", "streaming", "cloud", "cookie", "firewall", "username", "password",
    "login", "logout", "screenshot", "emoji", "meme", "drone", "robot",
    "satellite", "radar", "sonar", "laser", "backup", "reboot", "cursor",
    // Geographic terms — extra safety net against notable-entity false positives
    "arctic", "antarctic", "atlantic", "pacific", "europe", "asia", "africa",
    "america", "australia", "north", "south", "east", "west", "northern",
    "southern", "eastern", "western", "global", "worldwide", "international"
  ]);

  /**
   * Returns true when every alphanumeric token in the selection is a common
   * term — i.e. there is nothing for the LLM to explain.
   */
  function isFullyBlocklisted(text) {
    const tokens = text.toLowerCase().match(/[a-z0-9'-]+/g);
    if (!tokens || tokens.length === 0) return false;
    return tokens.every((t) => COMMON_TERMS_BLOCKLIST.has(t));
  }

  // ── In-memory cache ───────────────────────────────────────────────────────
  // Avoids duplicate API calls for the same text within a session.

  const termCache = new Map();

  /** Fast, non-cryptographic hash for cache keys. */
  function hashText(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
    }
    return (h >>> 0).toString(36);
  }

  // ── Color customisation ───────────────────────────────────────────────────

  const COLOR_PRESETS = {
    yellow: { bg: "rgba(255, 210, 50, 0.30)",  border: "rgba(180, 140, 0, 0.55)"   },
    blue:   { bg: "rgba(100, 160, 255, 0.25)", border: "rgba(40, 90, 200, 0.55)"   },
    green:  { bg: "rgba(100, 200, 120, 0.25)", border: "rgba(30, 130, 50, 0.55)"   },
    pink:   { bg: "rgba(255, 140, 170, 0.25)", border: "rgba(200, 60, 100, 0.55)"  },
    purple: { bg: "rgba(180, 130, 255, 0.25)", border: "rgba(100, 50, 200, 0.55)"  }
  };

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

  function resolveColor(name, customHex) {
    if (name === "custom" && /^#[0-9a-f]{3,6}$/i.test(customHex)) {
      return hexToColors(customHex);
    }
    return COLOR_PRESETS[name] || COLOR_PRESETS.yellow;
  }

  function applyHighlightColors() {
    browser.storage.local
      .get({
        jargonColor: "yellow",
        jargonCustomHex: "",
        notableColor: "blue",
        notableCustomHex: ""
      })
      .then((data) => {
        const j = resolveColor(data.jargonColor, data.jargonCustomHex);
        const n = resolveColor(data.notableColor, data.notableCustomHex);
        let el = document.getElementById("jt-color-overrides");
        if (!el) {
          el = document.createElement("style");
          el.id = "jt-color-overrides";
          (document.head || document.documentElement).appendChild(el);
        }
        el.textContent =
          `.jt-highlight{background:${j.bg}!important;border-bottom-color:${j.border}!important}` +
          `.jt-notable{background:${n.bg}!important;border-bottom-color:${n.border}!important}`;
      });
  }

  applyHighlightColors();
  browser.storage.onChanged.addListener((changes) => {
    if (
      changes.jargonColor ||
      changes.jargonCustomHex ||
      changes.notableColor ||
      changes.notableCustomHex
    ) {
      applyHighlightColors();
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Grab surrounding text for extra context. */
  function getSurroundingContext(selection) {
    if (!selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!container) return "";
    const full = container.textContent || "";
    const selText = selection.toString();
    const idx = full.indexOf(selText);
    if (idx === -1) return full.slice(0, CONFIG.CONTEXT_FALLBACK_CHARS);
    const before = full.slice(Math.max(0, idx - CONFIG.CONTEXT_CHARS), idx);
    const after  = full.slice(idx + selText.length, idx + selText.length + CONFIG.CONTEXT_CHARS);
    return before + selText + after;
  }

  // ── LLM prompts ───────────────────────────────────────────────────────────

  function buildJargonPrompt(selectedText, context) {
    return [
      "You are a plain-language translator for professional jargon and acronyms.",
      "",
      "CONTEXT (surrounding text on the page):",
      context,
      "",
      "SELECTED TEXT to analyse:",
      selectedText,
      "",
      "TASK:",
      "1. Identify jargon, technical terms, acronyms/initialisms, and domain-specific language in the SELECTED TEXT.",
      "   Only flag terms that a typical adult without domain expertise would genuinely not understand.",
      "   If a term appears in everyday conversation or mainstream news without explanation, skip it.",
      "2. For each term, provide a SHORT explanation (one sentence max) a non-expert would understand.",
      "   For acronyms, start with the expanded form, then explain if needed.",
      "3. Use the surrounding context to pick the most likely meaning when a term is ambiguous.",
      "4. Skip terms that are common everyday language or that the surrounding context already clearly defines.",
      "   Also skip common English words that have a technical origin but are universally understood,",
      "   such as: acronym, algorithm, data, server, network, digital, software, hardware, browser,",
      "   download, upload, database, virus, bandwidth, internet, website, streaming, cloud, backup.",
      "5. IGNORE hashtags (e.g. #science, #breaking) — never flag them.",
      "",
      "Return ONLY a JSON array. Each element must have exactly two keys:",
      '  "term"  – the exact string as it appears in the selected text (preserve original case),',
      '  "explanation" – the plain-language explanation.',
      "",
      "If there is no jargon, return an empty array: []",
      "",
      "Example output:",
      '[{"term":"API","explanation":"Application Programming Interface — a way for programs to talk to each other."}]'
    ].join("\n");
  }

  function buildNotablePrompt(selectedText, context) {
    return [
      "You are an assistant that identifies notable people, organizations, and entities mentioned in text.",
      "",
      "CONTEXT (surrounding text on the page):",
      context,
      "",
      "SELECTED TEXT to analyse:",
      selectedText,
      "",
      "TASK:",
      "1. Identify ONLY named people and named organizations (companies, agencies, NGOs, institutions,",
      "   teams) in the SELECTED TEXT that have broader public notability — an established public",
      "   presence, Wikipedia article, or well-known reputation.",
      "2. For each entity, provide a SHORT explanation (one sentence max) of who or what they are.",
      "3. Use the surrounding context to determine the most relevant description.",
      "4. For first names alone (e.g. \"Carl\"), only include if the surrounding context makes the",
      "   specific notable person unambiguously clear.",
      "5. Do NOT include geographic locations of any kind — countries, states, cities, regions,",
      "   continents, oceans, mountain ranges, rivers, or polar regions.",
      "   Examples of things to NEVER flag: Utah, Arctic, Europe, California, Amazon River, Pacific.",
      "6. Do NOT include common nouns, abstract concepts, historical periods, natural phenomena,",
      "   everyday capitalized words, hashtags, or private individuals.",
      "",
      "Return ONLY a JSON array. Each element must have exactly two keys:",
      '  "term"  – the exact name as it appears in the selected text (preserve original case),',
      '  "explanation" – a brief explanation of who or what they are.',
      "",
      "If there are no notable entities, return an empty array: []",
      "",
      "Example output:",
      '[{"term":"SpaceX","explanation":"Private aerospace company founded by Elon Musk, known for reusable rockets and the Starship program."}]'
    ].join("\n");
  }

  /**
   * Combined prompt used when both jargon and notable modes are enabled.
   * A single call is cheaper and faster than two parallel calls.
   */
  function buildCombinedPrompt(selectedText, context) {
    return [
      "You are a plain-language assistant. Analyse the SELECTED TEXT below and do two things:",
      "",
      "CONTEXT (surrounding text on the page):",
      context,
      "",
      "SELECTED TEXT to analyse:",
      selectedText,
      "",
      "TASK A — Jargon:",
      "  Identify jargon, technical terms, acronyms/initialisms, and domain-specific language.",
      "  Only flag terms a typical adult without domain expertise would genuinely not understand.",
      "  Skip terms that appear in everyday conversation or mainstream news without explanation,",
      "  including common words with technical origins: acronym, algorithm, data, server, network,",
      "  digital, software, hardware, browser, download, database, virus, bandwidth, streaming, cloud.",
      "  Skip hashtags. For each term give a SHORT plain-language explanation (one sentence max).",
      "  For acronyms, start with the expanded form.",
      "",
      "TASK B — Notable entities:",
      "  Identify ONLY named people and named organizations (companies, agencies, NGOs, institutions,",
      "  teams) with broader public notability (Wikipedia article or well-known reputation).",
      "  NEVER include geographic locations — countries, states, cities, regions, continents, oceans,",
      "  mountain ranges, rivers, or polar regions (e.g. Utah, Arctic, Europe, Pacific are all EXCLUDED).",
      "  Skip common nouns, abstract concepts, natural phenomena, hashtags, and private individuals.",
      "  Only include a first name if the context makes the specific notable person unambiguous.",
      "  Give a SHORT explanation of who/what they are.",
      "",
      'Return ONLY a JSON object with two keys, "jargon" and "notable", each an array of',
      '{ "term": "<exact text>", "explanation": "<one sentence>" } objects.',
      "Use empty arrays when nothing qualifies.",
      "",
      "Example:",
      '{"jargon":[{"term":"API","explanation":"Application Programming Interface — a way for programs to communicate."}],"notable":[{"term":"SpaceX","explanation":"Private aerospace company founded by Elon Musk."}]}'
    ].join("\n");
  }

  // ── LLM call ──────────────────────────────────────────────────────────────

  /** Structured error thrown when the background script reports a problem. */
  class LLMError extends Error {
    constructor(type, message, optionsUrl) {
      super(message);
      this.name = "LLMError";
      this.type = type;
      this.optionsUrl = optionsUrl || null;
    }
  }

  /** Send a prompt to the background LLM proxy and return the parsed result. */
  async function callLLM(prompt) {
    const response = await browser.runtime.sendMessage({ action: "callLLM", prompt });
    if (response.error) {
      const { type, message, optionsUrl } = response.error;
      throw new LLMError(type, message, optionsUrl);
    }
    return response.result;
  }

  // ── DOM manipulation ──────────────────────────────────────────────────────

  function clearHighlightsInRange(range) {
    const selector = "." + JARGON_CLASS + ", ." + NOTABLE_CLASS;
    document.querySelectorAll(selector).forEach((mark) => {
      if (!range.intersectsNode(mark)) return;
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  /**
   * Highlight every occurrence of every term inside the selection range.
   * Each term carries its own cssClass.  For each text node we:
   *
   *   1. COLLECT matches — find every case-insensitive position for each term.
   *   2. FILTER by word boundary — reject hits that are embedded inside a larger
   *      word.  Apostrophes are allowed adjacent to a match so that possessives
   *      like "API's" still resolve to the "API" term.
   *   3. DEDUPLICATE overlaps — sort descending by position (rightmost first),
   *      then walk the list keeping only matches that don't overlap the previous
   *      kept match.  This retains the rightmost/longest non-overlapping set.
   *   4. WRAP right-to-left — processing from the end of the text node backwards
   *      means earlier character indices are not shifted by DOM insertions, so
   *      each subsequent match is still valid without index correction.
   */
  function highlightTerms(terms, range) {
    const root =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    // Snapshot text nodes before any DOM mutation: iterating a live NodeList
    // while inserting/removing nodes can skip or revisit entries.
    const textNodes = [];
    while (treeWalker.nextNode()) {
      if (range.intersectsNode(treeWalker.currentNode)) {
        textNodes.push(treeWalker.currentNode);
      }
    }

    for (const node of textNodes) {
      const text = node.textContent;
      const matches = [];

      for (const { term, explanation, cssClass } of terms) {
        const termLower = term.toLowerCase();
        let pos = 0;
        while (pos < text.length) {
          const idx = text.toLowerCase().indexOf(termLower, pos);
          if (idx === -1) break;

          // Word-boundary check: reject the match if immediately adjacent to
          // an alphanumeric character (but NOT an apostrophe, so "API's" still
          // matches "API" and possessive/contraction forms are handled cleanly).
          const before = idx > 0 ? text[idx - 1] : "";
          const after  = idx + term.length < text.length ? text[idx + term.length] : "";
          if (/[^\W']/.test(before) || /[^\W']/.test(after)) {
            pos = idx + 1;
            continue;
          }

          matches.push({ idx, length: term.length, explanation, cssClass });
          pos = idx + term.length;
        }
      }

      if (matches.length === 0) continue;

      // Sort descending by start position (rightmost first); break ties by
      // preferring longer matches so a more specific term wins.
      matches.sort((a, b) => b.idx - a.idx || b.length - a.length);

      // Overlap removal: the first entry (rightmost) is always kept.  For each
      // subsequent candidate, only keep it when its end index does not reach
      // into the previous kept match (i.e. candidate.idx + candidate.length
      // must be <= the start of the already-kept match to its right).
      const kept = [matches[0]];
      for (let i = 1; i < matches.length; i++) {
        const prev = kept[kept.length - 1];
        if (matches[i].idx + matches[i].length <= prev.idx) {
          kept.push(matches[i]);
        }
      }

      // Wrap right-to-left.  `cur` always points to the text node whose left
      // portion still holds the unprocessed prefix.  Each iteration splits off
      // a <mark> and an optional right-side text node, leaving `cur` as the
      // shrinking left remnant — so its indices are unchanged for the next pass.
      let cur = node;
      for (const m of kept) {
        const t = cur.textContent;
        const beforeStr = t.slice(0, m.idx);
        const matchStr  = t.slice(m.idx, m.idx + m.length);
        const afterStr  = t.slice(m.idx + m.length);

        const mark = document.createElement("mark");
        mark.className = m.cssClass;
        mark.textContent = matchStr;
        mark.dataset.explanation = m.explanation;
        mark.addEventListener("mouseenter", showTooltip);
        mark.addEventListener("mouseleave", hideTooltip);

        const parent = cur.parentNode;
        if (afterStr)
          parent.insertBefore(document.createTextNode(afterStr), cur.nextSibling);
        parent.insertBefore(mark, cur.nextSibling);
        if (beforeStr) {
          cur.textContent = beforeStr;
        } else {
          parent.removeChild(cur);
        }
      }
    }
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  let activeTooltip = null;

  function showTooltip(e) {
    hideTooltip();
    const mark = e.currentTarget;
    const tip = document.createElement("span");
    tip.className = TOOLTIP_CLASS;
    tip.textContent = mark.dataset.explanation;
    document.body.appendChild(tip);

    const rect    = mark.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top  = rect.top  + window.scrollY - tipRect.height - CONFIG.TOOLTIP_GAP_PX;
    let left = rect.left + window.scrollX + rect.width / 2 - tipRect.width / 2;

    left = Math.max(
      CONFIG.TOOLTIP_MARGIN_PX,
      Math.min(left, window.innerWidth - tipRect.width - CONFIG.TOOLTIP_MARGIN_PX)
    );
    if (top < window.scrollY) top = rect.bottom + window.scrollY + CONFIG.TOOLTIP_GAP_PX;

    tip.style.top  = top  + "px";
    tip.style.left = left + "px";
    activeTooltip = tip;
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  // ── Loading / status indicators ───────────────────────────────────────────

  function showLoading(range) {
    const rect = range.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = LOADING_CLASS;
    el.textContent = "Translating\u2026";
    document.body.appendChild(el);
    el.style.top  = rect.top  + window.scrollY - el.offsetHeight - CONFIG.LOADING_GAP_PX + "px";
    el.style.left = rect.left + window.scrollX + "px";
    return el;
  }

  function hideLoading(el) {
    if (el) el.remove();
  }

  function showBrief(text, range) {
    const el = document.createElement("span");
    el.className = LOADING_CLASS + " jt-brief";
    el.textContent = text;
    document.body.appendChild(el);
    const rect = range.getBoundingClientRect();
    el.style.top  = rect.top  + window.scrollY - el.offsetHeight - CONFIG.LOADING_GAP_PX + "px";
    el.style.left = rect.left + window.scrollX + "px";
    setTimeout(() => el.remove(), CONFIG.BRIEF_DISPLAY_MS);
  }

  /**
   * Display an error near the selection.  For actionable errors (missing key,
   * bad key, bad JSON) we show a link to the Settings page.
   */
  function showError(err, range) {
    const errTip = document.createElement("span");
    errTip.className = TOOLTIP_CLASS + " jt-error";

    if (err instanceof LLMError && err.optionsUrl) {
      errTip.appendChild(document.createTextNode(err.message + " "));
      const a = document.createElement("a");
      a.href = err.optionsUrl;
      a.target = "_blank";
      a.textContent = "Open Settings";
      a.style.cssText = "color:inherit;text-decoration:underline;cursor:pointer";
      errTip.appendChild(a);
    } else {
      errTip.textContent = err.message;
    }

    document.body.appendChild(errTip);
    const rect = range.getBoundingClientRect();
    errTip.style.top  = rect.top  + window.scrollY - errTip.offsetHeight - CONFIG.TOOLTIP_GAP_PX + "px";
    errTip.style.left = rect.left + window.scrollX + "px";
    setTimeout(() => errTip.remove(), CONFIG.ERROR_DISPLAY_MS);
  }

  // ── Message listener ──────────────────────────────────────────────────────

  // Debounce timer: if the user triggers multiple selections quickly, only the
  // most recent one fires an LLM call.
  let _debounceTimer = null;

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action !== "translateJargon") return;

    // Cancel any pending debounced call from a previous rapid selection.
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }

    _debounceTimer = setTimeout(async () => {
      _debounceTimer = null;

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !selection.toString().trim()) return;

      const range        = selection.getRangeAt(0);
      const selectedText = selection.toString();
      const context      = getSurroundingContext(selection);

      const { enableJargon, enableNotable } = await browser.storage.local.get({
        enableJargon: true,
        enableNotable: true
      });

      if (!enableJargon && !enableNotable) return;

      // Pre-flight blocklist check: if every token is a common everyday term
      // there is nothing for the LLM to do.
      if (isFullyBlocklisted(selectedText)) {
        showBrief("No jargon found.", range);
        return;
      }

      clearHighlightsInRange(range);
      const loader = showLoading(range);

      try {
        let allTerms = [];

        if (enableJargon && enableNotable) {
          // ── Single combined call (faster + cheaper) ──
          const cacheKey = "combined:" + hashText(selectedText);
          let combined = termCache.get(cacheKey);
          if (!combined) {
            combined = await callLLM(buildCombinedPrompt(selectedText, context));
            termCache.set(cacheKey, combined);
          }
          if (Array.isArray(combined.jargon)) {
            for (const t of combined.jargon) {
              if (t && t.term && t.explanation) {
                allTerms.push({ term: t.term, explanation: t.explanation, cssClass: JARGON_CLASS });
              }
            }
          }
          if (Array.isArray(combined.notable)) {
            for (const t of combined.notable) {
              if (t && t.term && t.explanation) {
                allTerms.push({ term: t.term, explanation: t.explanation, cssClass: NOTABLE_CLASS });
              }
            }
          }
        } else if (enableJargon) {
          const cacheKey = "jargon:" + hashText(selectedText);
          let terms = termCache.get(cacheKey);
          if (!terms) {
            terms = await callLLM(buildJargonPrompt(selectedText, context));
            termCache.set(cacheKey, terms);
          }
          if (Array.isArray(terms)) {
            for (const t of terms) {
              if (t && t.term && t.explanation) {
                allTerms.push({ term: t.term, explanation: t.explanation, cssClass: JARGON_CLASS });
              }
            }
          }
        } else {
          const cacheKey = "notable:" + hashText(selectedText);
          let terms = termCache.get(cacheKey);
          if (!terms) {
            terms = await callLLM(buildNotablePrompt(selectedText, context));
            termCache.set(cacheKey, terms);
          }
          if (Array.isArray(terms)) {
            for (const t of terms) {
              if (t && t.term && t.explanation) {
                allTerms.push({ term: t.term, explanation: t.explanation, cssClass: NOTABLE_CLASS });
              }
            }
          }
        }

        // Post-filter: remove any terms the LLM returned that are in the blocklist.
        allTerms = allTerms.filter((t) => !COMMON_TERMS_BLOCKLIST.has(t.term.toLowerCase()));

        hideLoading(loader);

        if (allTerms.length === 0) {
          showBrief("No results found.", range);
          return;
        }

        const freshRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : range;
        highlightTerms(allTerms, freshRange);
      } catch (err) {
        hideLoading(loader);
        console.error("[Jargon Translator]", err);
        showError(err, range);
      }
    }, CONFIG.DEBOUNCE_MS);
  });
})();
