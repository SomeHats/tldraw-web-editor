import browser from "webextension-polyfill";

browser.action.onClicked.addListener((tab) => {
  console.log("hey");
  browser.scripting.executeScript({
    target: { tabId: tab.id! },
    files: ["src/content-script.js"],
  });
});
