// Create context menu
browser.contextMenus.create({
	id: "copy-links",
	title: "Copy links from selection",
	contexts: ["selection"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId !== "copy-links") return;

	// Inject script to extract links inside the page
	const [result] = await browser.tabs.executeScript(tab.id, {
		code: `
      (function() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return [];

        const range = sel.getRangeAt(0);

        // Clone selected DOM
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());

        // Directly query all <a> tags
        const anchors = div.querySelectorAll("a[href]");

        const out = [];
        const seen = new Set();

        anchors.forEach(a => {
          const url = a.getAttribute("href");
          if (url && !seen.has(url)) {
            seen.add(url);
            out.push(url);
          }
        });

        // Copy result
        if (out.length > 0) {
          const ta = document.createElement("textarea");
          ta.value = out.join("\\n");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }

        return out;
      })();
    `,
	});

	if (!result || result.length === 0) {
		browser.notifications.create({
			type: "basic",
			iconUrl: browser.runtime.getURL("icons/link-48.png"),
			title: "No links found",
			message: "No href links found in the selected HTML.",
		});
		return;
	}

	browser.notifications.create({
		type: "basic",
		iconUrl: browser.runtime.getURL("icons/link-48.png"),
		title: "Copied!",
		message: result.length + " links copied to clipboard.",
	});
});
