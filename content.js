(function () {
  "use strict";

  const JARGON_CLASS = "jt-highlight";
  const NOTABLE_CLASS = "jt-notable";
  const TOOLTIP_CLASS = "jt-tooltip";
  const LOADING_CLASS = "jt-loading";

  // ── Color customisation ────────────────────────────────────────────

  const COLOR_PRESETS = {
    yellow: { bg: "rgba(255, 210, 50, 0.30)", border: "rgba(180, 140, 0, 0.55)" },
    blue:   { bg: "rgba(100, 160, 255, 0.25)", border: "rgba(40, 90, 200, 0.55)" },
    green:  { bg: "rgba(100, 200, 120, 0.25)", border: "rgba(30, 130, 50, 0.55)" },
    pink:   { bg: "rgba(255, 140, 170, 0.25)", border: "rgba(200, 60, 100, 0.55)" },
    purple: { bg: "rgba(180, 130, 255, 0.25)", border: "rgba(100, 50, 200, 0.55)" }
  };

  function hexToColors(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      bg: `rgba(${r}, ${g}, ${b}, 0.25)`,
      border: `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, 0.55)`
    };
  }

  function resolveColor(name, customHex) {
    if (name === "custom" && /^#[0-9a-f]{3,6}$/i.test(customHex)) {
      return hexToColors(customHex);
    }
    return COLOR_PRESETS[name] || COLOR_PRESETS.yellow;
  }

  /** Inject (or update) a <style> element that overrides highlight colours. */
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

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Grab surrounding text for extra context (up to ~800 chars each side). */
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
    if (idx === -1) return full.slice(0, 1600);
    const before = full.slice(Math.max(0, idx - 800), idx);
    const after = full.slice(idx + selText.length, idx + selText.length + 800);
    return before + selText + after;
  }

  /** Build the jargon prompt sent to the LLM. */
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
      "   Lean towards inclusion — it is better to flag a borderline term than to miss genuine jargon.",
      "2. For each term, provide a SHORT explanation (one sentence max) a non-expert would understand.",
      "   For acronyms, start with the expanded form, then explain if needed.",
      "3. Use the surrounding context to pick the most likely meaning when a term is ambiguous.",
      "4. Skip terms that are common everyday language (e.g. TV, email, GPS) or that the surrounding context already clearly defines.",
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

  /** Build the notable-entities prompt sent to the LLM. */
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
      "1. Identify named people, organizations, companies, agencies, and institutions in the SELECTED TEXT, but ONLY those with broader public notability.",
      "   The entity must be someone or something a reader could look up — with an established public presence, Wikipedia article, or well-known reputation.",
      "2. For each entity, provide a SHORT explanation (one sentence max) of who or what they are and why they are relevant here.",
      "3. Use the surrounding context to determine the most relevant description.",
      "4. For first names alone (e.g. \"Carl\"), only include if the surrounding context makes it unambiguously clear which specific notable person is meant.",
      "5. Do NOT include generic common nouns, everyday words that happen to be capitalized, hashtags, or private individuals without public notability.",
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

  // ── LLM call ─────────────────────────────────────────────────────────
  // Delegates to the background script to avoid the host page's CSP.

  async function callLLM(prompt) {
    const response = await browser.runtime.sendMessage({ action: "callLLM", prompt });
    if (response.error) throw new Error(response.error);
    return response.terms;
  }

  // ── DOM manipulation ─────────────────────────────────────────────────

  /** Remove highlights + tooltips only within a given range. */
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
   * Highlight every occurrence of every term inside the selection range in
   * a single pass.  Each term carries its own cssClass.  For each text node we:
   *   1. Find all index positions for every term (case-insensitive).
   *   2. Discard matches that sit inside a larger word (word-boundary check).
   *   3. Remove overlapping matches (keep the longer / earlier one).
   *   4. Wrap matches right-to-left so earlier indices stay valid.
   */
  function highlightTerms(terms, range) {
    const root =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    // Snapshot text nodes first — the list must not change while we mutate.
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

          // Word-boundary check: reject matches embedded inside a word.
          const before = idx > 0 ? text[idx - 1] : "";
          const after =
            idx + term.length < text.length ? text[idx + term.length] : "";
          if (/\w/.test(before) || /\w/.test(after)) {
            pos = idx + 1;
            continue;
          }

          matches.push({ idx, length: term.length, explanation, cssClass });
          pos = idx + term.length;
        }
      }

      if (matches.length === 0) continue;

      // Sort descending by position so right-to-left wrapping preserves indices.
      matches.sort((a, b) => b.idx - a.idx || b.length - a.length);

      // Drop overlapping matches (keep the rightmost / longest first, then
      // only accept earlier matches that don't overlap).
      const kept = [matches[0]];
      for (let i = 1; i < matches.length; i++) {
        const prev = kept[kept.length - 1];
        if (matches[i].idx + matches[i].length <= prev.idx) {
          kept.push(matches[i]);
        }
      }

      // Wrap right-to-left.  After each split the left portion of the text
      // node keeps its original indices, so earlier matches remain valid.
      let cur = node;
      for (const m of kept) {
        const t = cur.textContent;
        const beforeStr = t.slice(0, m.idx);
        const matchStr = t.slice(m.idx, m.idx + m.length);
        const afterStr = t.slice(m.idx + m.length);

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

  // ── Tooltip ──────────────────────────────────────────────────────────

  let activeTooltip = null;

  function showTooltip(e) {
    hideTooltip();
    const mark = e.currentTarget;
    const tip = document.createElement("span");
    tip.className = TOOLTIP_CLASS;
    tip.textContent = mark.dataset.explanation;
    document.body.appendChild(tip);

    // Position just above the highlighted term.
    const rect = mark.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.top + window.scrollY - tipRect.height - 6;
    let left = rect.left + window.scrollX + rect.width / 2 - tipRect.width / 2;

    // Keep inside viewport horizontally.
    left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
    // Flip below if no room above.
    if (top < window.scrollY) {
      top = rect.bottom + window.scrollY + 6;
    }

    tip.style.top = top + "px";
    tip.style.left = left + "px";
    activeTooltip = tip;
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  // ── Loading indicator ────────────────────────────────────────────────

  function showLoading(range) {
    const rect = range.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = LOADING_CLASS;
    el.textContent = "Translating\u2026";
    document.body.appendChild(el);
    el.style.top = rect.top + window.scrollY - el.offsetHeight - 6 + "px";
    el.style.left = rect.left + window.scrollX + "px";
    return el;
  }

  function hideLoading(el) {
    if (el) el.remove();
  }

  /** Show a brief, auto-dismissing message near the selection. */
  function showBrief(text, range) {
    const el = document.createElement("span");
    el.className = LOADING_CLASS + " jt-brief";
    el.textContent = text;
    document.body.appendChild(el);
    const rect = range.getBoundingClientRect();
    el.style.top = rect.top + window.scrollY - el.offsetHeight - 6 + "px";
    el.style.left = rect.left + window.scrollX + "px";
    setTimeout(() => el.remove(), 3000);
  }

  // ── Message listener ─────────────────────────────────────────────────

  browser.runtime.onMessage.addListener(async (msg) => {
    if (msg.action !== "translateJargon") return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    const context = getSurroundingContext(selection);

    const { enableJargon, enableNotable } = await browser.storage.local.get({
      enableJargon: true,
      enableNotable: true
    });

    if (!enableJargon && !enableNotable) return;

    clearHighlightsInRange(range);

    const loader = showLoading(range);
    try {
      // Fire enabled LLM calls in parallel.
      const promises = [];
      if (enableJargon) {
        promises.push(
          callLLM(buildJargonPrompt(selectedText, context))
            .then((terms) => ({ cssClass: JARGON_CLASS, terms }))
        );
      }
      if (enableNotable) {
        promises.push(
          callLLM(buildNotablePrompt(selectedText, context))
            .then((terms) => ({ cssClass: NOTABLE_CLASS, terms }))
        );
      }

      const results = await Promise.all(promises);
      hideLoading(loader);

      // Merge all valid terms with their assigned CSS class.
      const allTerms = [];
      for (const { cssClass, terms } of results) {
        if (!Array.isArray(terms)) continue;
        for (const t of terms) {
          if (t && t.term && t.explanation) {
            allTerms.push({ term: t.term, explanation: t.explanation, cssClass });
          }
        }
      }

      if (allTerms.length === 0) {
        showBrief("No results found.", range);
        return;
      }

      // Re-grab the range — the selection may still be intact.
      const freshRange =
        selection.rangeCount > 0 ? selection.getRangeAt(0) : range;

      highlightTerms(allTerms, freshRange);
    } catch (err) {
      hideLoading(loader);
      console.error("[Jargon Translator]", err);

      // Show a brief, non-intrusive error near the selection.
      const errTip = document.createElement("span");
      errTip.className = TOOLTIP_CLASS + " jt-error";
      errTip.textContent = err.message;
      document.body.appendChild(errTip);
      const rect = range.getBoundingClientRect();
      errTip.style.top = rect.top + window.scrollY - errTip.offsetHeight - 6 + "px";
      errTip.style.left = rect.left + window.scrollX + "px";
      setTimeout(() => errTip.remove(), 5000);
    }
  });
})();
