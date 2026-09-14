const themes = {
	"sophb.mpp (simplified)": "sophb.mpp.simple",
	"sophb.mpp": "sophb.mpp"
};
localStorage.theme ??= 'sophb.mpp (simplified)';
function setTheme(theme = localStorage.theme) {
	if (themes[theme] == null)
		throw new ReferenceError(`Unknown theme "${theme}"`);

	const style = document.getElementById('stylesheet');
	style.src = `themes/${themes[theme]}.css`;
}
setTheme();
