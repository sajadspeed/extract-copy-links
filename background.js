// Create context menu
browser.contextMenus.create({
	id: "copy-links",
	title: "Copy links from selection",
	contexts: ["selection"],
});

// Function to copy text using temporary tab
async function copyToClipboard(text) {
	// Create a temporary background tab
	const tab = await browser.tabs.create({
		url: "about:blank",
		active: false,
	});

	try {
		// Execute copy command in the temporary tab
		await browser.tabs.executeScript(tab.id, {
			code: `
        const ta = document.createElement("textarea");
        ta.value = ${JSON.stringify(text)};
        document.body.appendChild(ta);
        ta.select();
        const success = document.execCommand("copy");
        ta.remove();
        success;
      `,
		});

		return true;
	} catch (error) {
		console.error("Copy failed:", error);
		return false;
	} finally {
		// Close the temporary tab
		await browser.tabs.remove(tab.id);
	}
}

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
		title: "No links found",
		message: result.join(""),
	});
	console.log(result);

	// Copy using temporary tab
	const textToCopy = result.join("\n");
	const success = await copyToClipboard(textToCopy);

	if (success) {
		browser.notifications.create({
			type: "basic",
			iconUrl: browser.runtime.getURL("icons/link-48.png"),
			title: "Copied!",
			message: result.length + " links copied to clipboard.",
		});
	} else {
		browser.notifications.create({
			type: "basic",
			iconUrl: browser.runtime.getURL("icons/link-48.png"),
			title: "Copy failed",
			message: "Failed to copy links to clipboard.",
		});
	}
});
