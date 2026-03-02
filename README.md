# Jargon Translator — Firefox Extension

A lightweight Firefox extension that translates professional jargon, technical terms, and acronyms into plain language using a free/low-cost LLM.

## How It Works

1. **Highlight** any text on a webpage.
2. **Right-click** and choose **"Translate Jargon"**.
3. The extension sends the selected text (plus surrounding context) to an LLM, which identifies jargon and acronyms.
4. Each detected term is highlighted with a subtle underline.
5. **Hover** over a highlighted term to see a brief, plain-language explanation.

The tooltip appears only while your cursor is on the term and disappears the moment you move away.

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
| **API Endpoint** | `https://openrouter.ai/api/v1/chat/completions` | Any OpenAI-compatible endpoint. |
| **Model** | `google/gemini-2.0-flash-001` | Free on OpenRouter. Any model that can return JSON works. |

4. Click **Save**.

### Recommended free/low-cost models (via OpenRouter)

- `google/gemini-2.0-flash-001` — fast, free tier available
- `meta-llama/llama-3.3-70b-instruct` — free tier available
- `mistralai/mistral-small-3.1-24b-instruct` — free tier available

## Project Structure

```
├── manifest.json      # Extension manifest (Manifest V2)
├── background.js      # Registers the right-click context menu
├── content.js         # Core logic: LLM call, highlighting, tooltips
├── tooltip.css        # Styles for highlights, tooltips, and loading state
├── options.html       # Settings page markup
├── options.js         # Settings page logic
└── icons/
    ├── icon.svg       # Source icon
    ├── icon-48.png    # Toolbar icon (48×48)
    └── icon-96.png    # High-DPI icon (96×96)
```

## Privacy

- The extension **only activates when you explicitly select text and choose "Translate Jargon"** from the context menu.
- Only the selected text and a small window of surrounding context are sent to the configured LLM endpoint. No other page data is collected or transmitted.
- Your API key is stored locally in the browser via `browser.storage.local` and is never sent anywhere except the endpoint you configure.

## Development

To reload after making changes:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **"Reload"** next to Jargon Translator.

No build step is needed — the extension is plain JavaScript and CSS.

## License

MIT
