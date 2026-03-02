(function () {
  "use strict";

  const JARGON_CLASS = "jt-highlight";
  const TOOLTIP_CLASS = "jt-tooltip";
  const LOADING_CLASS = "jt-loading";

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

  /** Build the prompt sent to the LLM. */
  function buildPrompt(selectedText, context) {
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
      "1. Identify every piece of jargon, technical term, or acronym/initialism in the SELECTED TEXT.",
      "2. For each term, provide a SHORT explanation (one sentence max) a non-expert would understand.",
      "   For acronyms, start with the expanded form, then explain if needed.",
      "3. Use the surrounding context to pick the most likely meaning when a term is ambiguous.",
      "4. Do NOT flag a term if the surrounding context already explains its meaning.",
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
    document.querySelectorAll("." + JARGON_CLASS).forEach((mark) => {
      if (!range.intersectsNode(mark)) return;
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  /**
   * Highlight every occurrence of every term inside the selection range in
   * a single pass.  For each text node we:
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

      for (const { term, explanation } of terms) {
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

          matches.push({ idx, length: term.length, explanation });
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
        mark.className = JARGON_CLASS;
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

    clearHighlightsInRange(range);

    const loader = showLoading(range);
    try {
      const prompt = buildPrompt(selectedText, context);
      const terms = await callLLM(prompt);

      hideLoading(loader);

      const validTerms = Array.isArray(terms)
        ? terms.filter((t) => t && t.term && t.explanation)
        : [];

      if (validTerms.length === 0) {
        showBrief("No jargon found.", range);
        return;
      }

      // Re-grab the range — the selection may still be intact.
      const freshRange =
        selection.rangeCount > 0 ? selection.getRangeAt(0) : range;

      highlightTerms(validTerms, freshRange);
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
