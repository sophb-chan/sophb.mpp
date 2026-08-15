const userscriptURLs = [
	'https://greasyfork.org/en/scripts/554578-tealmidiplayer',
	'https://greasyfork.org/en/scripts/582106-token-switcher',
	'https://greasyfork.org/en/scripts/567148-eval',
	'https://greasyfork.org/en/scripts/542677-multiplayer-piano-optimizations-emotes'
];
for (const userscriptURL of userscriptURLs) {
	let attempts = 0;
	while (true) {
		try {
			runFromGreasyfork(userscriptURL);
			break;
		} catch (err) {
			attempts++
			if (attempts === 15) {
				console.error('Failed to load an addon.');
				break;
			};
		}
	}
}
