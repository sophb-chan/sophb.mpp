const Lexis = {
	prefix: '[Lexis]:',
	isLoaded: false,
	targetLanguage: localStorage.LexisLocale,
	fallbackLanguages: navigator.languages,
	on: {},
};

Lexis.init = async (fallbackLanguage = 'en') => {
	if (Lexis.isInitialized)
		throw new Error('Lexis has already been initialized.');

	// Try target locale and fallback locales
	const locales = [Lexis.targetLanguage, ...(Lexis.fallbackLanguages ?? [])].filter(Boolean);
	for (const locale of locales) {
		try {
			const json = await getLocaleJSON(locale);
			if (json == null) continue;
			else {
				Lexis.locale = locale;
				break;
			}
		} catch (err) {
			console.error(Lexis.prefix, err);
			continue;
		}
	}
	// Fallback if there's still no applicable locale
	Lexis.locale ??= fallbackLanguage

	// Publicize methods
	async function getLocaleJSON(languageCode = Lexis.locale) {
		const url = new URL(location.href);
		url.pathname = `/locales/${languageCode}/translation.json`;
		url.search = '';
		const localeURL = url.toString();
		const r = await fetch(localeURL);
		if (r.status === 404) {
			return null;
		} else if (r.status !== 200)
			throw new Error(`HTTP Status ${r.status} when fetching translation JSON`);

		const text = await r.text();
		const parsed = JSON.parse(text);
		return parsed;
	}
	function translate(key, info = {}) {
		if (info.count) {
			const count =
				info.count === 1
					? 'one'
					: (info.count === 0 && Lexis.translations[key + '_zero'] != null
						? 'zero'
						: 'other');
			return Lexis.translations[key + '_' + count];
		} else {
			return Lexis.translations[key];
		}
	}
	async function loadLocale(languageCode) {
		Lexis.isLoaded = false; // Set loaded status to false

		// Load locale
		const defaultTranslations = await getLocaleJSON(fallbackLanguage);
		Lexis.translations = await getLocaleJSON(languageCode);
		localStorage.LexisLocale = Lexis.locale;
		if (defaultTranslations != null) {
			for (const [key, value] of Object.entries(Lexis.translations)) {
				Lexis.translations[key] ||= defaultTranslations[key];
			}
		}

		// Set loaded status to true and execute onload callback
		Lexis.isLoaded = true;
		localStorage.LexisLocale = Lexis.locale;
		if (Object.typeOf(Lexis.on.load) === 'function')
			Lexis.on.load(structuredClone(Lexis));

		console.log(Lexis.prefix, `Loaded locale "${languageCode}".`);
		return Lexis.translations
	}
	async function translateElement(root = document.body) {
		if (root.getAttribute('translated') != null) return false;
		for (const element in (root.children ?? [root])) {
			console.log(element);
			if (element.getAttribute('translated') != null) continue;
			if (element.children.length > 0)
				translateElement(element);
			else {
				if (element.getAttribute('original') == null) element.setAttribute('original', element.innerHTML);
				element.innerHTML = translate(element.getAttribute('original') ?? element.innerHTML);
			}
		}
	}
	await loadLocale(Lexis.locale);
	Object.assign(Lexis, {
		getLocaleJSON,
		translate,
		loadLocale,
		translateElement,
	});

	// Set initiialized status to true and execute onload callback
	Lexis.isInitialized = true;
	if (Object.typeOf(Lexis.on.init) === 'function')
		Lexis.on.init(structuredClone(Lexis));

	console.log(Lexis.prefix, 'Initialized.');
	return Lexis;
};
