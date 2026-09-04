if (
	'LanguageDetector' in self
	&&
	'Translator' in self
) {
	async function translate(text, inputLanguage, outputLanguage = 'en') {
		const translator = await Translator.create({
			sourceLanguage: inputLanguage,
			targetLanguage: outputLanguage,
		});
		const translated = await translator.translate(text);
		translator.destroy();
		return translated;
	}
	async function detectLanguage(text) {
		const detector = await LanguageDetector.create({
			expectedInputLanguages: ["ru", "ko", "pt-BR"],
		});
		const results = detector.detect(text);
		const mostConfidentResult = results.reduce(
			(mostConfidentYet, currentResult) => {
				if (currentResult.confidence > mostConfidentYet.confidence)
					return currentResult;
				else return mostConfidentYet;
			},
			{
				confidence: 0,
				detectedLanguage: 'en',
			},
		);
		detector.destroy();
		return mostConfidentResult.detectedLanguage;
	}
	async function smartTranslate(text, outputLanguage) {
		const detectedLanguage = detectLanguage(text);
		const translated = translate(text, detectLanguage, outputLanguage);
		return translated;
	}

	Object.assign(globalThis, {
		translate,
		detectLanguage,
		smartTranslate,
	});
	console.log('Translator APIs loaded!');
} else {
	console.log('Your browser does not support live translator features.');
}
