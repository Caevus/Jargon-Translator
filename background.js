browser.contextMenus.create({
  id: "translate-jargon",
  title: "Translate Jargon",
  contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-jargon") {
    browser.tabs.sendMessage(tab.id, {
      action: "translateJargon",
      selectedText: info.selectionText
    });
  }
});
