const userscriptURLs = [
	'https://greasyfork.org/en/scripts/554578-tealmidiplayer',
	'https://greasyfork.org/en/scripts/582106-token-switcher',
	'https://greasyfork.org/en/scripts/567148-eval',
	'https://greasyfork.org/en/scripts/542677-multiplayer-piano-optimizations-emotes'
];

async function loadAddons() {
	for (const userscriptURL of userscriptURLs) {
		const maxAttempts = 3;
		for (let attempts = 0; attempts <= maxAttempts;) {
			if (attempts === maxAttempts) {
				console.error('Failed to load an addon.');
				break;
			}

			try {
				await runFromGreasyfork(userscriptURL);
				break;
			} catch (err) {
				attempts++;
			}
		}
	}
}
loadAddons();
