// Create context menu
browser.contextMenus.create({
	id: "copy-links",
	title: "Extract && Copy links",
	contexts: ["selection"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId !== "copy-links") return;

	try {
		// Extract links
		const [links] = await browser.tabs.executeScript(tab.id, {
			code: `
        (function() {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return [];
          const range = sel.getRangeAt(0);
          const div = document.createElement("div");
          div.appendChild(range.cloneContents());
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

		if (!links || links.length === 0) {
			browser.notifications.create({
				type: "basic",
				iconUrl: browser.runtime.getURL("icons/link-48.png"),
				title: "No links found",
				message: "No href links found in the selected HTML.",
			});
			return;
		}

		// Store links in storage
		const textToCopy = links.join("\n");

		await browser.storage.local.set({ linksToCopy: textToCopy });

		// Inject content script to copy from storage
		await browser.tabs.executeScript(tab.id, {
			code: `
        (async function() {
          try {
            // Get links from storage
            const result = await browser.storage.local.get('linksToCopy');
            const text = result.linksToCopy;
            
            if (!text) return false;
            
            // Copy to clipboard
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const success = document.execCommand('copy');
            document.body.removeChild(ta);
            
            // Clean up
            await browser.storage.local.remove('linksToCopy');
            
            return success;
          } catch(e) {
            return false;
          }
        })().then(success => {
          // Send result back to background
          document.dispatchEvent(new CustomEvent('copyResult', { 
            detail: { success: success } 
          }));
        });
      `,
		});

		// Wait for result from content script
		await new Promise((resolve) => {
			const timeout = setTimeout(() => resolve(false), 2000);

			const handleMessage = (request, sender, sendResponse) => {
				if (request.type === "copyResult") {
					clearTimeout(timeout);
					browser.runtime.onMessage.removeListener(handleMessage);
					resolve(request.success);
				}
			};

			browser.runtime.onMessage.addListener(handleMessage);
		});

		browser.notifications.create({
			type: "basic",
			iconUrl: browser.runtime.getURL("icons/link-48.png"),
			title: "Copied!",
			message: links.length + " links copied to clipboard.",
		});
	} catch (error) {
		browser.notifications.create({
			type: "basic",
			iconUrl: browser.runtime.getURL("icons/link-48.png"),
			title: "Copy failed",
			message: "Failed to copy links to clipboard: " + error.message,
		});
	}
});
