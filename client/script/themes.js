const themes = {
	"sophb.mpp (simplified)": "sophb.mpp.simple",
	"sophb.mpp": "sophb.mpp"
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
	for (const [name, value] of Object.entries(themes)) {
		const option = document.createElement('option');
		option.textContent = name;
		option.value = value;
		themeSelect.append(option);
	}
	themeSelect.onchange = () => setTheme(themeSelect.value);
}
refreshThemes();
setTheme();
