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

  async function callLLM(prompt) {
    const { apiKey, apiEndpoint, modelName } = await browser.storage.local.get({
      apiKey: "",
      apiEndpoint: "https://openrouter.ai/api/v1/chat/completions",
      modelName: "google/gemini-2.0-flash-001"
    });

    if (!apiKey) {
      throw new Error(
        "No API key configured. Right-click the Jargon Translator icon → Preferences to set one."
      );
    }

    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const raw =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!raw) throw new Error("Empty response from LLM.");

    // Strip markdown code fences if present.
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  }

  // ── DOM manipulation ─────────────────────────────────────────────────

  /** Remove all previous highlights + tooltips injected by this extension. */
  function clearPreviousHighlights() {
    document.querySelectorAll("." + TOOLTIP_CLASS).forEach((el) => el.remove());
    document.querySelectorAll("." + JARGON_CLASS).forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  /**
   * Walk the text nodes inside the user's selection range and wrap each
   * occurrence of `term` in a <mark> with a hover tooltip.
   *
   * Handles terms that may span multiple text nodes by working with the
   * range's common ancestor and processing only nodes within the range.
   */
  function highlightTerm(term, explanation, range) {
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement,
      NodeFilter.SHOW_TEXT
    );

    const textNodes = [];
    while (treeWalker.nextNode()) {
      if (range.intersectsNode(treeWalker.currentNode)) {
        textNodes.push(treeWalker.currentNode);
      }
    }

    const termLower = term.toLowerCase();

    for (const node of textNodes) {
      const text = node.textContent;
      const idx = text.toLowerCase().indexOf(termLower);
      if (idx === -1) continue;

      // Split the text node into before | match | after.
      const before = text.slice(0, idx);
      const match = text.slice(idx, idx + term.length);
      const after = text.slice(idx + term.length);

      const mark = document.createElement("mark");
      mark.className = JARGON_CLASS;
      mark.textContent = match;
      mark.dataset.explanation = explanation;

      // Tooltip show / hide via mouse events.
      mark.addEventListener("mouseenter", showTooltip);
      mark.addEventListener("mouseleave", hideTooltip);

      const parent = node.parentNode;
      if (after) parent.insertBefore(document.createTextNode(after), node.nextSibling);
      parent.insertBefore(mark, node.nextSibling);
      if (before) {
        node.textContent = before;
      } else {
        parent.removeChild(node);
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

  // ── Message listener ─────────────────────────────────────────────────

  browser.runtime.onMessage.addListener(async (msg) => {
    if (msg.action !== "translateJargon") return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    const context = getSurroundingContext(selection);

    clearPreviousHighlights();

    const loader = showLoading(range);
    try {
      const prompt = buildPrompt(selectedText, context);
      const terms = await callLLM(prompt);

      hideLoading(loader);

      if (!Array.isArray(terms) || terms.length === 0) return;

      // Re-grab the range — the selection may still be intact.
      const freshRange =
        selection.rangeCount > 0 ? selection.getRangeAt(0) : range;

      for (const { term, explanation } of terms) {
        if (term && explanation) {
          highlightTerm(term, explanation, freshRange);
        }
      }
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
