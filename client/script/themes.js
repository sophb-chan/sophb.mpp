const themes = {
	"sophb.mpp (simplified)": "sophb.mpp.simple",
	"sophb.mpp": "sophb.mpp",
	"MPPNet": "mppnet"
};
localStorage.theme ??= 'sophb.mpp (simplified)';
function setTheme(theme = localStorage.theme) {
	if (themes[theme] == null)
		throw new ReferenceError(`Unknown theme "${theme}"`);

	const style = document.getElementById('stylesheet');
	style.href = `themes/${themes[theme]}.css`;
	localStorage.theme = theme;
}
function refreshThemes() {
	const themeSelect = document.getElementById('site-theme-select');
	themeSelect.innerHTML = '';
	for (const name of Object.keys(themes)) {
		const option = document.createElement('option');
		option.textContent = name;
		option.value = name;
		themeSelect.append(option);
	}
	themeSelect.value = localStorage.theme;
}
refreshThemes();
setTheme();
