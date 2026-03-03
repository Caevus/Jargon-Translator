# Jargon Translator — Firefox Extension

A lightweight Firefox extension that translates professional jargon, technical terms, and acronyms into plain language using a free/low-cost LLM. It also identifies notable people, organizations, and entities mentioned in text.

## How It Works

1. **Highlight** any text on a webpage.
2. **Right-click** and choose **"Translate Jargon"**.
3. The extension sends the selected text (plus surrounding context) to an LLM, which identifies jargon/acronyms and notable entities.
4. Each detected term is highlighted with a subtle colored underline — jargon and notable entities use distinct colors.
5. **Hover** over a highlighted term to see a brief, plain-language explanation.

The tooltip appears only while your cursor is on the term and disappears the moment you move away.

### What gets highlighted

- **Jargon & acronyms** — technical terms, initialisms, and domain-specific language that a non-expert might not know. Common everyday terms (TV, email, GPS) and hashtags are ignored.
- **Notable people & entities** — publicly notable people, organizations, companies, and agencies. A name is only flagged when broader notability can be established (e.g. "Carl Sagan" is flagged; a bare "Carl" is only flagged if context makes the identity unambiguous). Private individuals and hashtags are ignored.

Both categories can be toggled independently from the toolbar popup.

## Setup

### 1. Install the extension

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on…"**.
3. Select the `manifest.json` file in this directory.

### 2. Configure an API key

The extension needs access to an OpenAI-compatible chat-completions endpoint.
[OpenRouter](https://openrouter.ai/) is recommended — it offers free-tier models that work well.

1. Right-click the Jargon Translator icon in the toolbar and select **"Manage Extension"**.
2. Click **"Preferences"** (or go to `about:addons`, find Jargon Translator, and click Preferences).
3. Enter your settings:

| Field | Default | Notes |
|-------|---------|-------|
| **API Key** | *(none)* | Required. An OpenRouter API key (`sk-or-…`) works out of the box. |
| **API Endpoint** | `https://openrouter.ai/api/v1/chat/completions` | Any OpenAI-schema compatible endpoint. |
| **Model** | `google/gemini-2.0-flash-001` | Free on OpenRouter. Any model that can return JSON works. |

4. Click **Save**.

### Recommended free/low-cost models (via OpenRouter)

- `google/gemini-2.0-flash-001` — fast, free tier available
- `meta-llama/llama-3.3-70b-instruct` — free tier available
- `mistralai/mistral-small-3.1-24b-instruct` — free tier available

## Features

### Highlight color customization

Both jargon and notable-entity highlight colors can be changed from the options page. Five presets are available (yellow, blue, green, pink, purple), plus a custom option where you can enter any hex color code.

### Settings backup (export / import)

The options page includes **Export** and **Import** buttons that save all settings (including your API key) to a JSON file. This is useful if:

- You need to reinstall the extension and want to preserve your API key.
- You want to copy settings to another machine.

The extension also uses a stable internal ID (`jargon-translator@caevus`), which helps `browser.storage.local` persist across extension reloads.

### Check for updates

The options page has a **Check for updates** button that compares your installed version against the latest `manifest.json` in the GitHub repository. If a newer version is available, it shows a download link for the ZIP archive. After extracting, reload the extension from `about:debugging`.

> **Note:** Firefox extensions cannot modify their own installed files, so fully automatic self-updating isn't possible for sideloaded add-ons. This button is the next best thing — one click to check, one click to download.

### Toolbar popup

Click the Jargon Translator icon in the toolbar to toggle jargon and notable-entity highlighting on or off independently. The colored swatches in the popup reflect your chosen highlight colors.

## Project Structure

```
├── manifest.json      # Extension manifest (Manifest V2)
├── background.js      # Context menu, LLM proxy, and update checker
├── content.js         # Core logic: prompts, highlighting, tooltips, color injection
├── tooltip.css        # Base styles for highlights, tooltips, and loading state
├── options.html       # Settings page markup (API config, colors, backup, updates)
├── options.js         # Settings page logic
├── popup.html         # Toolbar popup markup
├── popup.js           # Toolbar popup logic (toggles, dynamic swatches)
└── icons/
    ├── icon.svg       # Source icon
    ├── icon-48.png    # Toolbar icon (48×48)
    └── icon-96.png    # High-DPI icon (96×96)
```

## Privacy

- The extension **only activates when you explicitly select text and choose "Translate Jargon"** from the context menu.
- Only the selected text and a small window of surrounding context are sent to the configured LLM endpoint. No other page data is collected or transmitted.
- Your API key is stored locally in the browser via `browser.storage.local` and is never sent anywhere except the endpoint you configure.
- The "Check for updates" button makes a single read-only request to the GitHub API to fetch the latest `manifest.json`. No personal data is sent.

## Development

To reload after making changes:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **"Reload"** next to Jargon Translator.

No build step is needed — the extension is plain JavaScript and CSS.

## License

MIT
