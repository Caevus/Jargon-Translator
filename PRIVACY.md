# Privacy Policy — Jargon Translator

**Last updated:** March 8, 2026

Jargon Translator is a browser extension that translates professional jargon, acronyms, and notable entities into plain language using AI. This policy describes what data the extension handles and how.

## Data Sent to Third Parties

When you trigger a translation (via right-click context menu, keyboard shortcut, or popup), the extension sends the following to an AI language model API:

- **Your selected text** — the exact text you highlighted on the page.
- **Surrounding context** — up to approximately 800 characters of text surrounding your selection, used to help the AI disambiguate terms. This context is drawn from the same DOM element as your selection.

This data is sent to whichever API endpoint you have configured in the extension's settings. The default is **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`). If you change the endpoint to a different provider, your data is sent there instead. The extension does not control the privacy practices of these third-party API providers. You should review the privacy policy of whichever provider you use.

**Your API key** is included as a Bearer token in each request to authenticate with the API provider. It is stored locally in your browser and is only transmitted to the configured API endpoint.

## Data Sent to GitHub

When you use the "Check for updates" feature in the extension's settings page, the extension makes a single request to the **GitHub API** (`https://api.github.com`) to compare your installed version against the latest version in the source repository. No user data or browsing data is included in this request.

## Data Stored Locally

The extension stores the following in your browser's local storage (`browser.storage.local`). This data never leaves your device:

- API key
- API endpoint URL
- Model name
- Feature toggles (jargon translation, notable entity detection)
- Highlight color preferences
- An in-memory (session-only) cache of recent translations to avoid redundant API calls

## Data the Extension Does Not Collect

- No analytics or telemetry
- No browsing history or page URLs
- No cookies or tracking identifiers
- No personal information beyond what appears in text you choose to translate
- No data is collected passively or in the background — all API calls are initiated by a deliberate user action

## Data Transmission Is User-Initiated

All data transmission occurs only as a direct result of your action: selecting text and invoking the translate command, or clicking "Check for updates." The extension never sends data without your explicit input.

## Third-Party Services

| Service | When contacted | What is sent |
|---|---|---|
| Your configured LLM provider (default: OpenRouter) | Each translation request | Selected text, surrounding context, API key |
| GitHub API | Manual update check | Version comparison request (no user data) |

## Your Control

- You choose which API provider to use and supply your own API key.
- You can disable either or both translation modes (jargon/notable) at any time.
- No account or registration is required to use the extension.
- Uninstalling the extension removes all locally stored data.

## Changes to This Policy

Updates to this policy will be posted in the extension's source repository. The "Last updated" date at the top will reflect the most recent revision.

## Contact

If you have questions about this policy, you can open an issue on the [GitHub repository](https://github.com/Caevus/Jargon-Translator).
