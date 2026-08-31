// ==UserScript==
// @name               TealMIDIPlayer
// @name:ru            TealMIDIPlayer
// @name:pt-BR         TealMIDIPlayer
// @homepage           <gone>
// @version            2.11.0-beta
// @description        MIDI Player bot for MPP. (Based off of Teal's MIDI player)
// @description:pt-BR  Bot tocador de MIDIs para MPP. (Baseado no tocador de MIDIs do Teal)
// @description:ru     Бот-MIDI-плеер для MPP. (Основан на MIDI-плеере, встроенном в Teal)
// @author             sophb.chan
// @match              *://multiplayerpiano.net/*
// @match              *://multiplayerpiano.org/*
// @match              *://multiplayerpiano.com/*
// @match              *://piano.mpp.community/*
// @match              *://mpp.8448.space/*
// @match              *://mpp.7458.space/*
// @match              *://www.multiplayerpiano.dev/*
// @match              *://mpp.smp-meow.net/*
// @match              *://sophb-mpp.vercel.app/*
// @icon               data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant              GM_info
// @license            MIT
// @namespace          https://greasyfork.org/users/1459137
// ==/UserScript==


if (!localStorage.getItem('tmp_prefix')) localStorage.tmp_prefix = 'p.';
let prefix = localStorage.tmp_prefix;

const sep = '-'

// script info
const GMinfo = (() => {
	try {
		return GM_info;
	} catch {
		return {
			script: {
				name: "TealMIDIPlayer",
				author: "sophb.chan",
				version: "Unknown (no `GM_info` accessible, running from DevTools?)",
				homepage: "<gone>",
				embedded: true,
			},
		}
	};
})();
const {
	name,
	version,
	author,
	link,
	embedded,
} = GMinfo.script;

// JMIDIPlayer
// "THE BEER-WARE LICENSE" (Revision 42):
// <me@seq.wtf> wrote this file.
// As long as you retain this notice you can do whatever you want with this stuff.
// If we meet some day, and you think this stuff is worth it, you can buy me a beer in return.
// - James

const HEADER_LENGTH = 14;
const DEFAULT_TEMPO = 500000; // 120 bpm / 500ms/qn
const EVENT_SIZE = 8;
const EVENT_CODE = {
	NOTE_ON: 0x09,
	NOTE_OFF: 0x08,
	CONTROL_CHANGE: 0x0B,
	SET_TEMPO: 0x51,
	END_OF_TRACK: 0x2F
};

class JMIDIPlayer {
	// playback state
	#isPlaying = false;
	#currentTick = 0;
	#currentTempo = DEFAULT_TEMPO;
	#playbackWorker = null;

	// loading state & file data
	#isLoading = false;
	#totalEvents = 0;
	#totalTicks = 0;
	#songTime = 0;
	#ppqn = 0;
	#numTracks = 0;
	#timeMap = [];

	// configurable properties
	#playbackSpeed = 1; // multiplier

	// event listeners
	#eventListeners = {};

	constructor() {
		this.#eventListeners = {};
		this.#createWorker();
	}

	on(event, callback) {
		if (!this.#eventListeners[event]) {
			this.#eventListeners[event] = [];
		}
		this.#eventListeners[event].push(callback);
	}

	off(event, callback) {
		if (!this.#eventListeners[event]) return;
		const index = this.#eventListeners[event].indexOf(callback);
		if (index > -1) {
			this.#eventListeners[event].splice(index, 1);
		}
	}

	emit(event, data) {
		if (!this.#eventListeners[event]) return;
		for (const callback of this.#eventListeners[event]) {
			callback(data);
		}
	}

	async loadArrayBuffer(arrbuf) {
		const start = performance.now();
		this.#isLoading = true;

		return new Promise((resolve, reject) => {
			const handleMessage = (e) => {
				const msg = e.data;

				if (msg.type === 'parseComplete') {
					this.#playbackWorker.removeEventListener('message', handleMessage);
					this.#isLoading = false;
					this.#totalEvents = msg.totalEvents;
					this.#totalTicks = msg.totalTicks;
					this.#songTime = msg.songTime;
					this.#ppqn = msg.ppqn;
					this.#numTracks = msg.numTracks;
					this.#timeMap = msg.timeMap;

					const parseTime = performance.now() - start;
					this.emit("fileLoaded", { parseTime });
					resolve([0, parseTime]); // [readTime, parseTime]
				} else if (msg.type === 'parseError') {
					this.#playbackWorker.removeEventListener('message', handleMessage);
					this.unload();
					reject(new Error(msg.error));
				}
			};

			this.#playbackWorker.addEventListener('message', handleMessage);

			// transfer the buffer to the worker
			this.#playbackWorker.postMessage({
				type: 'load',
				buffer: arrbuf
			}, [arrbuf]);
		});
	}

	async loadFile(file) {
		const arrbuf = await file.arrayBuffer();
		return this.loadArrayBuffer(arrbuf);
	}

	unload() {
		this.stop();

		if (this.#isLoading) {
			this.#isLoading = false;
		}

		this.#numTracks = 0;
		this.#ppqn = 0;
		this.#totalEvents = 0;
		this.#totalTicks = 0;
		this.#songTime = 0;
		this.#timeMap = [];
		this.#currentTick = 0;
		this.#currentTempo = DEFAULT_TEMPO / this.#playbackSpeed;

		if (this.#playbackWorker) {
			this.#playbackWorker.postMessage({
				type: 'unload'
			});
		}

		this.emit("unloaded");
	}

	play() {
		if (this.#isPlaying) return;
		if (this.#isLoading) return;
		if (this.#totalTicks === 0) throw new Error("No MIDI data loaded.");

		this.#isPlaying = true;
		this.#playbackWorker.postMessage({
			type: 'play'
		});
		this.emit("play");
	}

	pause() {
		if (!this.#isPlaying) return;

		this.#isPlaying = false;
		this.#playbackWorker.postMessage({
			type: 'pause'
		});
		this.emit("pause");
	}

	stop() {
		if (!this.#isPlaying && this.#currentTick === 0) return;

		const needsEmit = this.#currentTick > 0;

		this.#isPlaying = false;
		this.#currentTick = 0;
		this.#currentTempo = DEFAULT_TEMPO / this.#playbackSpeed;

		this.#playbackWorker.postMessage({
			type: 'stop'
		});

		if (needsEmit) this.emit("stop");
	}

	seek(tick) {
		if (this.#isLoading || this.#totalTicks === 0) return;

		tick = Math.min(Math.max(0, tick), this.#totalTicks);
		if (Number.isNaN(tick)) return;

		const wasPlaying = this.#isPlaying;
		if (wasPlaying) this.pause();

		this.#currentTick = tick;
		this.#playbackWorker.postMessage({
			type: 'seek',
			tick
		});

		this.emit("seek", {
			tick
		});

		if (wasPlaying) this.play();
	}

	#createWorker() {
		const workerCode = `
			const EVENT_SIZE = 8;
			const DEFAULT_TEMPO = 500000;
			const EVENT_CODE = { NOTE_ON: 0x09, NOTE_OFF: 0x08, CONTROL_CHANGE: 0x0B, SET_TEMPO: 0x51, END_OF_TRACK: 0x2F };
			const HEADER_LENGTH = 14;

			// parsed MIDI data
			let tracks = [];
			let ppqn = 0;
			let tempoEvents = [];
			let totalTicks = 0;
			let numTracks = 0;
			let format = 0;

			// playback state
			let playbackSpeed = 1;
			let isPlaying = false;
			let currentTick = 0;
			let currentTempo = DEFAULT_TEMPO;
			let trackEventPointers = [];
			let startTick = 0;
			let startTime = 0;
			let playLoopInterval = null;
			const sampleRate = 5; // ms

			function parseVarlen(view, offset) {
				let value = 0;
				let startOffset = offset;
				let checkNextByte = true;
				while (checkNextByte) {
					const currentByte = view.getUint8(offset);
					value = (value << 7) | (currentByte & 0x7F);
					++offset;
					checkNextByte = !!(currentByte & 0x80);
				}
				return [value, offset - startOffset];
			}

			function parseTrack(view, trackOffset) {
				let eventIndex = 0;
				let capacity = 2048;
				let packedBuffer = new ArrayBuffer(capacity * EVENT_SIZE);
				let packedView = new DataView(packedBuffer);

				const trackTempoEvents = [];
				let totalTicks = 0;
				let currentTick = 0;
				let runningStatus = 0;

				const trackLength = view.getUint32(trackOffset + 4);
				let offset = trackOffset + 8;
				const endOffset = offset + trackLength;

				while (offset < endOffset) {
					const deltaTimeVarlen = parseVarlen(view, offset);
					offset += deltaTimeVarlen[1];
					currentTick += deltaTimeVarlen[0];

					let statusByte = view.getUint8(offset);
					if (statusByte < 0x80) {
						statusByte = runningStatus;
					} else {
						runningStatus = statusByte;
						++offset;
					}

					const eventType = statusByte >> 4;
					let ignore = false;

					let eventCode, p1, p2, p3;

					switch (eventType) {
						case 0x8: // note off
						case 0x9: // note on
							eventCode = eventType;
							const note = view.getUint8(offset++);
							const velocity = view.getUint8(offset++);

							p1 = statusByte & 0x0F; // channel
							p2 = note;
							p3 = velocity;
							break;

						case 0xB: // control change
							eventCode = eventType;
							const ccNum = view.getUint8(offset++);
							const ccValue = view.getUint8(offset++);
							if (ccNum !== 64) ignore = true;

							p1 = statusByte & 0x0F; // channel
							p2 = ccNum;
							p3 = ccValue;
							break;

						case 0xA:   // polyphonic key pressure
						case 0xE:   // pitch wheel change
							++offset; // fallthrough
						case 0xC:   // program change
						case 0xD:   // channel pressure
							++offset;
							ignore = true;
							break;

						case 0xF: // system common / meta event
							if (statusByte === 0xFF) {
								const metaType = view.getUint8(offset++);
								const lengthVarlen = parseVarlen(view, offset);
								offset += lengthVarlen[1];

								switch (metaType) {
									case 0x51: // set tempo
										if (lengthVarlen[0] !== 3) {
											ignore = true;
										} else {
											p1 = view.getUint8(offset);
											p2 = view.getUint8(offset + 1);
											p3 = view.getUint8(offset + 2);
											const uspq = (p1 << 16) | (p2 << 8) | p3;
											trackTempoEvents.push({ tick: currentTick, uspq: uspq });
											eventCode = EVENT_CODE.SET_TEMPO;
										}
										break;
									case 0x2F: // end of track
										eventCode = EVENT_CODE.END_OF_TRACK;
										offset = endOffset;
										break;
									default:
										ignore = true;
										break;
								}

								offset += lengthVarlen[0];
							} else if (statusByte === 0xF0 || statusByte === 0xF7) {
								ignore = true;
								const lengthVarlen = parseVarlen(view, offset);
								offset += lengthVarlen[0] + lengthVarlen[1];
							} else {
								ignore = true;
							}
							break;

						default:
							ignore = true;
							break;
					}

					if (!ignore) {
						if (eventIndex >= capacity) {
							capacity *= 2;
							const newBuffer = new ArrayBuffer(capacity * EVENT_SIZE);
							new Uint8Array(newBuffer).set(new Uint8Array(packedBuffer));
							packedBuffer = newBuffer;
							packedView = new DataView(packedBuffer);
						}

						const byteOffset = eventIndex * EVENT_SIZE;

						if (currentTick > 0xFFFFFFFF) {
							throw new Error(\`MIDI file too long! Track tick count exceeds maximum.\`);
						}

						packedView.setUint32(byteOffset, currentTick);
						packedView.setUint8(byteOffset + 4, eventCode);
						packedView.setUint8(byteOffset + 5, p1 || 0);
						packedView.setUint8(byteOffset + 6, p2 || 0);
						packedView.setUint8(byteOffset + 7, p3 || 0);

						++eventIndex;
					}
				}

				packedBuffer = packedBuffer.slice(0, eventIndex * EVENT_SIZE);
				totalTicks = currentTick;

				return { packedBuffer, tempoEvents: trackTempoEvents, totalTicks };
			}

			function parseMIDI(buffer) {
				const view = new DataView(buffer);

				// HEADER
				const magic = view.getUint32(0);
				if (magic !== 0x4d546864) {
					throw new Error(\`Invalid MIDI magic! Expected 4d546864, got \${magic.toString(16).padStart(8, "0")}.\`);
				}

				const length = view.getUint32(4);
				if (length !== 6) {
					throw new Error(\`Invalid header length! Expected 6, got \${length}.\`);
				}

				format = view.getUint16(8);
				numTracks = view.getUint16(10);

				if (format === 0 && numTracks > 1) {
					throw new Error(\`Invalid track count! Format 0 MIDIs should only have 1 track, got \${numTracks}.\`);
				}

				if (format >= 2) {
					throw new Error(\`Unsupported MIDI format: \${format}.\`);
				}

				ppqn = view.getUint16(12);

				if (ppqn === 0) {
					throw new Error(\`Invalid PPQN/division value!\`);
				}

				if ((ppqn & 0x8000) !== 0) {
					throw new Error(\`SMPTE timecode format is not supported!\`);
				}

				// TRACK OFFSETS
				const trackOffsets = new Array(numTracks);
				let currentOffset = HEADER_LENGTH;

				for (let i = 0; i < numTracks; ++i) {
					if (currentOffset >= buffer.byteLength) {
						throw new Error(\`Reached EOF while looking for track \${i}. Tracks reported: \${numTracks}.\`);
					}

					const trackMagic = view.getUint32(currentOffset);
					if (trackMagic !== 0x4d54726b) {
						throw new Error(\`Invalid track \${i} magic! Expected 4d54726b, got \${trackMagic.toString(16).padStart(8, "0")}.\`);
					}

					const trackLength = view.getUint32(currentOffset + 4);
					trackOffsets[i] = currentOffset;
					currentOffset += trackLength + 8;
				}

				// PARSE TRACKS
				tracks = new Array(numTracks);
				totalTicks = 0;
				tempoEvents = [];

				for (let i = 0; i < numTracks; ++i) {
					const result = parseTrack(view, trackOffsets[i]);
					tracks[i] = {
						packedBuffer: result.packedBuffer,
						eventCount: result.packedBuffer.byteLength / EVENT_SIZE,
						view: new DataView(result.packedBuffer)
					};
					totalTicks = Math.max(totalTicks, result.totalTicks);
					result.tempoEvents.forEach(event => tempoEvents.push(event));
				}

				tempoEvents.sort((a, b) => a.tick - b.tick);

				const tempoMap = [{ tick: 0, uspq: DEFAULT_TEMPO }];

				for (const event of tempoEvents) {
					const lastTempo = tempoMap[tempoMap.length - 1];
					if (event.tick === lastTempo.tick) {
						lastTempo.uspq = event.uspq;
					} else {
						tempoMap.push(event);
					}
				}

				let totalMs = 0;
				const timeMap = [{ tick: 0, time: 0, uspq: DEFAULT_TEMPO }];

				for (let i = 0; i < tempoMap.length; ++i) {
					const lastTimeData = timeMap[timeMap.length - 1];
					const lastUspq = lastTimeData.uspq;
					const currentTempoEvent = tempoMap[i];

					const ticksSinceLast = currentTempoEvent.tick - lastTimeData.tick;
					const msSinceLast = (ticksSinceLast * (lastUspq / 1000)) / ppqn;
					const cumulativeTime = lastTimeData.time + msSinceLast;

					timeMap.push({
						tick: currentTempoEvent.tick,
						time: cumulativeTime,
						uspq: currentTempoEvent.uspq
					});
				}

				const lastTimeData = timeMap[timeMap.length - 1];
				const ticksInFinalSegment = totalTicks - lastTimeData.tick;
				const msInFinalSegment = (ticksInFinalSegment * (lastTimeData.uspq / 1000)) / ppqn;
				totalMs = lastTimeData.time + msInFinalSegment;

				const songTime = totalMs / 1000;
				const totalEvents = tracks.map(t => t?.eventCount || 0).reduce((a, b) => a + b, 0);

				return { totalEvents, totalTicks, songTime, ppqn, numTracks, timeMap };
			}

			function findNextEventIndex(trackIndex, tick) {
				const track = tracks[trackIndex];
				if (track.eventCount === 0) return 0;

				let low = 0;
				let high = track.eventCount;

				while (low < high) {
					const mid = Math.floor(low + (high - low) / 2);
					const eventTick = track.view.getUint32(mid * EVENT_SIZE);

					if (eventTick < tick) {
						low = mid + 1;
					} else {
						high = mid;
					}
				}
				return low;
			}

			function getCurrentTick() {
				if (!startTime) return startTick;

				const tpms = ppqn / (currentTempo / 1000);
				const ms = performance.now() - startTime;

				return Math.round(tpms * ms) + startTick;
			}

			function playLoop() {
				if (!isPlaying) {
					clearInterval(playLoopInterval);
					playLoopInterval = null;
					return;
				}

				currentTick = getCurrentTick();

				if (tracks.every((track, i) => trackEventPointers[i] >= track.eventCount) || currentTick > totalTicks) {
					isPlaying = false;
					clearInterval(playLoopInterval);
					playLoopInterval = null;
					currentTick = 0;
					startTick = 0;
					startTime = 0;
					postMessage({ type: 'endOfFile' });
					return;
				}

				const eventPointers = [];
				let totalEventsToPlay = 0;

				for (let i = 0; i < tracks.length; ++i) {
					const track = tracks[i];
					if (!track) continue;

					let ptr = trackEventPointers[i];
					const startPtr = ptr;

					while (ptr < track.eventCount && track.view.getUint32(ptr * EVENT_SIZE) <= currentTick) {
						const eventData = track.view.getUint32((ptr * EVENT_SIZE) + 4);
						const eventTypeCode = eventData >> 24;

						// handle tempo changes immediately
						if (eventTypeCode === EVENT_CODE.SET_TEMPO) {
							const eventTick = track.view.getUint32(ptr * EVENT_SIZE);
							const uspq = eventData & 0xFFFFFF;
							const oldTempo = currentTempo * playbackSpeed;
							const msAfterTempoEvent = ((currentTick - eventTick) * (oldTempo / 1000)) / ppqn;

							startTick = eventTick;
							startTime = performance.now() - msAfterTempoEvent;
							currentTempo = uspq / playbackSpeed;
						}
						++ptr;
					}

					const numEventsInTrack = ptr - startPtr;
					if (numEventsInTrack > 0) {
						eventPointers.push({ trackIndex: i, start: startPtr, count: numEventsInTrack });
						totalEventsToPlay += numEventsInTrack;
					}
				}

				if (totalEventsToPlay > 0) {
					const buffer = new ArrayBuffer(totalEventsToPlay * EVENT_SIZE);
					const destView = new Uint8Array(buffer);
					let destOffset = 0;

					for (const pointer of eventPointers) {
						const track = tracks[pointer.trackIndex];
						const sourceByteOffset = pointer.start * EVENT_SIZE;
						const sourceByteLength = pointer.count * EVENT_SIZE;

						const sourceView = new Uint8Array(track.packedBuffer, sourceByteOffset, sourceByteLength);

						destView.set(sourceView, destOffset);
						destOffset += sourceByteLength;

						trackEventPointers[pointer.trackIndex] += pointer.count;
					}
					postMessage({ type: 'events', buffer: buffer, currentTick }, [buffer]);
				}
			}

			self.onmessage = function (e) {
				const msg = e.data;

				try {
					switch (msg.type) {
						case 'load':
							const result = parseMIDI(msg.buffer);
							trackEventPointers = new Array(tracks.length).fill(0);
							currentTick = 0;
							currentTempo = DEFAULT_TEMPO / playbackSpeed;
							postMessage({
								type: 'parseComplete',
								totalEvents: result.totalEvents,
								totalTicks: result.totalTicks,
								songTime: result.songTime,
								ppqn: result.ppqn,
								numTracks: result.numTracks,
								timeMap: result.timeMap
							});
							break;

						case 'unload':
							tracks = [];
							ppqn = 0;
							tempoEvents = [];
							totalTicks = 0;
							numTracks = 0;
							trackEventPointers = [];
							currentTick = 0;
							currentTempo = DEFAULT_TEMPO / playbackSpeed;
							isPlaying = false;
							if (playLoopInterval) {
								clearInterval(playLoopInterval);
								playLoopInterval = null;
							}
							break;

						case 'play':
							if (isPlaying) return;
							if (tracks.length === 0) return;
							isPlaying = true;
							startTime = performance.now();
							playLoopInterval = setInterval(playLoop, sampleRate);
							break;

						case 'pause':
							if (!isPlaying) return;
							isPlaying = false;
							clearInterval(playLoopInterval);
							playLoopInterval = null;
							startTick = getCurrentTick();
							currentTick = startTick;
							startTime = 0;
							postMessage({ type: 'tickUpdate', tick: currentTick });
							break;

						case 'stop':
							isPlaying = false;
							clearInterval(playLoopInterval);
							playLoopInterval = null;
							currentTick = 0;
							startTick = 0;
							startTime = 0;
							currentTempo = DEFAULT_TEMPO / playbackSpeed;
							break;

						case 'seek':
							const tick = msg.tick;

							// binary search for tempo
							if (tempoEvents.length > 0) {
								let low = 0;
								let high = tempoEvents.length - 1;
								let bestMatch = -1;

								while (low <= high) {
									const mid = Math.floor(low + (high - low) / 2);
									if (tempoEvents[mid].tick <= tick) {
										bestMatch = mid;
										low = mid + 1;
									} else {
										high = mid - 1;
									}
								}

								currentTempo = ((bestMatch !== -1) ? tempoEvents[bestMatch].uspq : DEFAULT_TEMPO) / playbackSpeed;
							}

							for (let i = 0; i < tracks.length; ++i) {
								trackEventPointers[i] = findNextEventIndex(i, tick);
							}

							currentTick = tick;
							startTick = tick;
							postMessage({ type: 'tickUpdate', tick });
							break;

						case 'setPlaybackSpeed':
							const oldSpeed = playbackSpeed;
							playbackSpeed = msg.speed;

							if (isPlaying) {
								const tick = getCurrentTick();
								currentTempo = (currentTempo * oldSpeed) / playbackSpeed;
								startTick = tick;
								startTime = performance.now();
							}
							break;
					}
				} catch (error) {
					console.error(error);
					postMessage({ type: 'parseError', error: error.message });
				}
			};
		`;

		const blob = new Blob([workerCode], {
			type: 'application/javascript'
		});
		const workerUrl = URL.createObjectURL(blob);
		this.#playbackWorker = new Worker(workerUrl);

		this.#playbackWorker.onmessage = (e) => {
			const msg = e.data;

			switch (msg.type) {
				case 'events':
					this.#currentTick = msg.currentTick;

					const view = new DataView(msg.buffer);
					const numEvents = msg.buffer.byteLength / EVENT_SIZE;

					for (let i = 0; i < numEvents; i++) {
						const byteOffset = i * EVENT_SIZE;
						const eventTick = view.getUint32(byteOffset);
						const eventData = view.getUint32(byteOffset + 4);

						const eventTypeCode = eventData >> 24;
						const event = {
							tick: eventTick
						};

						switch (eventTypeCode) {
							case EVENT_CODE.NOTE_ON:
							case EVENT_CODE.NOTE_OFF:
								event.type = eventTypeCode;
								event.channel = (eventData >> 16) & 0xFF;
								event.note = (eventData >> 8) & 0xFF;
								event.velocity = eventData & 0xFF;
								break;
							case EVENT_CODE.CONTROL_CHANGE:
								event.type = 0x0B;
								event.channel = (eventData >> 16) & 0xFF;
								event.ccNum = (eventData >> 8) & 0xFF;
								event.ccValue = eventData & 0xFF;
								break;
							case EVENT_CODE.SET_TEMPO:
								event.type = 0xFF;
								event.metaType = 0x51;
								event.uspq = eventData & 0xFFFFFF;
								this.#currentTempo = event.uspq / this.#playbackSpeed;
								this.emit("tempoChange");
								break;
							case EVENT_CODE.END_OF_TRACK:
								event.type = 0xFF;
								event.metaType = 0x2F;
								break;
						}

						this.emit("midiEvent", event);
					}
					break;

				case 'endOfFile':
					this.#isPlaying = false;
					this.#currentTick = 0;
					this.emit("endOfFile");
					this.emit("stop");
					break;

				case 'tickUpdate':
					this.#currentTick = msg.tick;
					break;
			}
		};

		this.#playbackWorker.onerror = (error) => {
			console.error('Worker error:', error);
		};
	}

	getTimeAtTick(tick) {
		if (!this.#timeMap || this.#timeMap.length === 0 || this.#ppqn === 0) {
			return 0;
		}

		let low = 0;
		let high = this.#timeMap.length - 1;
		let bestMatchIndex = 0;

		while (low <= high) {
			const mid = Math.floor(low + (high - low) / 2);
			const midTick = this.#timeMap[mid].tick;

			if (midTick <= tick) {
				bestMatchIndex = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		const segment = this.#timeMap[bestMatchIndex];

		const ticksSinceSegmentStart = tick - segment.tick;
		const msSinceSegmentStart = (ticksSinceSegmentStart * (segment.uspq / 1000)) / this.#ppqn;

		const totalMs = segment.time + msSinceSegmentStart;
		return totalMs / 1000;
	}


	get isLoading() {
		return this.#isLoading;
	}

	get isPlaying() {
		return this.#isPlaying;
	}

	get trackCount() {
		return this.#numTracks;
	}

	get songTime() {
		return this.#songTime;
	}

	get ppqn() {
		return this.#ppqn;
	}

	get currentTempo() {
		return 60_000_000 / this.#currentTempo;
	}

	get totalEvents() {
		return this.#totalEvents;
	}

	get totalTicks() {
		return this.#totalTicks;
	}

	get currentTick() {
		return this.#currentTick;
	}

	get playbackSpeed() {
		return this.#playbackSpeed;
	}

	set playbackSpeed(speed) {
		speed = +speed;
		if (Number.isNaN(speed)) throw new Error("Playback speed must be a valid number!");
		if (speed <= 0) throw new Error("Playback speed must be a positive number!");

		const oldSpeed = this.#playbackSpeed;
		if (speed === oldSpeed) return;

		this.#playbackSpeed = speed;

		if (this.#playbackWorker) {
			this.#playbackWorker.postMessage({
				type: 'setPlaybackSpeed',
				speed
			});
		}
	}
}

let player = new JMIDIPlayer();
player.isLoaded = () => !player.isLoading && player.trackCount > 0;

localStorage.tmp_clientside ??= 'true';
let clientside = localStorage.tmp_clientside === 'true';
const charLimit = 512;
function send(...msgs) {
	const arrow = '↱ ',
		subarrow = "↳ ",
		lineConnector = '❘';
	const lineLimit = 3;

	msgs = msgs.join(` ${sep} `);
	msgs = arrow + msgs;
	msgs = msgs.split('\n');

	if (msgs.length > lineLimit && !clientside)
		MPP.chat.send(`${arrow}[long (multi-line) message (${msgs.length} lines)]`);

	msgs.forEach((msg, msgI) => {
		// switch functions depending on amount of messages
		let sendFunc;
		if (clientside) {
			sendFunc = (text, bypassArrow = false) => {
				MPP.chat.receive({
					t: Date.now(),
					p: MPP.client.getOwnParticipant(),
					t: Date.now(),
					a: ((bypassArrow || msgI === 0) ? '' : subarrow) + text
				});
			}
		} else if (msgs.length > lineLimit) {
			sendFunc =
				(text, bypassArrow = false) => {
					MPP.chat.receive({
						t: Date.now(),
						p: {
							id: MPP.client.getOwnParticipant().id,
							_id: MPP.client.getOwnParticipant()._id,
							color: MPP.client.getOwnParticipant().color,
							name: `(Only visible to you) ${sep} ${MPP.client.getOwnParticipant().name}`,
						},
						t: Date.now(),
						a: ((bypassArrow || msgI === 0) ? '' : subarrow) + text
					});
				}
		} else {
			sendFunc = (text, bypassArrow = false) => {
				MPP.chat.send(((bypassArrow || msgI === 0) ? '' : subarrow) + text);
			}
		}


		// send connector line if text is empty
		if (msg.replaceAll(' ', '').length === 0) {
			sendFunc(lineConnector, true);
			return;
		}

		if (msg.length > charLimit) {
			let totalString = [];
			let splitter = msg.split(' ').length <= 8 ? '' : ' ';
			let split = msg.split(splitter);

			if (Math.ceil(msg.length / charLimit) > lineLimit);
			MPP.chat.send(`${arrow}[long message (${Math.ceil(msg.length / charLimit)} lines)]`);

			split.forEach(subsplit => {
				totalString.push(subsplit);
				if ((subarrow + totalString.join(splitter)).length > charLimit) {
					totalString.pop();
					sendFunc(totalString.join(splitter));
					totalString = [];
				}
			})
			if (totalString.length > 0) sendFunc(totalString.join(splitter));
		} else {
			sendFunc(msg);
		}
	})
}
// Hijacked send for clientside
const ogSend = MPP.chat.send;
globalThis.hijackedSend ??= function hijackedSend(msg) {
	if (clientside && msg.startsWith(prefix)) {
		document.getElementById('chat-input').value = '';
		const event = {
			m: 'a',
			id: 'hijacked',
			a: msg,
			p: MPP.client.getOwnParticipant(),
			t: Date.now(),
		};
		MPP.chat.receive(event);
		chatMessageHandler(event);
	} else ogSend(msg);
}
if (MPP.chat.send !== hijackedSend) MPP.chat.send = hijackedSend;

function midiLoading() {
	playNote('as3', 1);
	setTimeout(() => {
		stopNote('as3');
		playNote('cs4', 1);
	}, 250);
	setTimeout(() => {
		stopNote('cs4');
		playNote('fs4', 1);
	}, 500);
	setTimeout(() => {
		stopNote('fs4');
	}, 750);
	setTimeout(() => {
		stopNote('c4');
	}, 1000)
}

let loadnotes;
function loadNotes(start) {
	if (start) {
		midiLoading()
		loadnotes = setInterval(midiLoading, 1e3);
	} else clearInterval(loadnotes);
}
function validURL(url) {
	let result;
	try {
		new URL(url);
		result = true;
	} catch {
		result = false;
	}
	return result;
}
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const playing = {};
function validMIDI(arrBuf) {
	const decoder = new TextDecoder('utf8');
	const textdata = decoder.decode(arrBuf);
	if (textdata.startsWith('MThd'))
		return true;
	else
		return false;
}
const signal = new AbortController().signal;
async function playMIDIfromURL(targetMIDI) {
	url = queue[getFileName(targetMIDI)] ?? queue[targetMIDI];
	if (url == null) {
		queue[getFileName(targetMIDI)] = targetMIDI;
		url = targetMIDI;
	}

	eventsplayed = 0;
	let fetchtime, fetchstart, parsetime, result;

	loadNotes(true);
	await delay(50);

	const errorRoutine = (err) => {
		result = false;

		send("There was an error when playing the file.", `Error: \`${err.message ?? JSON.stringify(err)}\``);
		loadNotes(false);

		delete queue[Object.keys(queue)[0]];
		if (Object.keys(queue).length > 0) {
			setTimeout(() => {
				send(`Downloading next song on the queue... (\`${Object.keys(queue)[0]}\`)`);
				playMIDIfromURL(Object.keys(queue)[0]);
			}, 1e3);
		} else {
			send('Queue is now empty');
		}
	}

	console.log('trying to play', url);
	if (validURL(url) || url instanceof ArrayBuffer) {
		const loadMethod = validURL(url) ? 'url' : 'arrbuf';
		if (player.isPlaying) {
			player.stop();
			player.unload();
		}
		try {
			fetchstart = Date.now();

			let arrayBuf;
			if (validURL(url)) {
				const r = await fetch(url, { signal });
				arrayBuf = await r.arrayBuffer();
			} else {
				arrayBuf = url;
			}

			if (!validMIDI(arrayBuf))
				throw new Error('The file provided is invalid, as it doesn\'t start with the header "MThd".');

			fetchtime = Date.now() - fetchstart;
			if (arrayBuf) {
				let parsestart = Date.now();
				await player.loadArrayBuffer(arrayBuf);
				player.play();
				parsetime = Date.now() - parsestart;

				console.log(`Fetch time: ${fetchtime}ms\nParse time: ${parsetime}ms`);
				send(
					`Fetched MIDI in ${fetchtime}ms.`,
					`Parsed MIDI in ${parsetime}ms.`,
					`Now playing \`${targetMIDI}\`.`
				);

				playing.name = getFileName(url);
				playing.url = url;
			}
		} catch (err) {
			errorRoutine(err);
		}
	} else {
		errorRoutine(new Error('Invalid URL'));
	}

	loadNotes(false);
	return result;
}

function playNote(note, vel) {
	if (clientside)
		MPP.piano.play(note, vel, MPP.client.getOwnParticipant(), 0);
	else
		MPP.press(note, vel);
}
function stopNote(note) {
	if (clientside)
		MPP.piano.stop(note, MPP.client.getOwnParticipant(), 0);
	else
		MPP.release(note);
}

let looping = false;
let sustain = false;
let transpose = 0;
let volume = 1;
const jevents = {
	noteon: 9,
	noteoff: 8,
	ctrlChange: 0x0B,
	setTempo: 0x51,
	end: 0x2F,
	meta: 0xFF
};
let eventsplayed = 0;
const keys = Object.keys(MPP.piano.keys);
let currenttick;
player.on('midiEvent', (event) => {
	eventsplayed++;
	currenttick = event.tick;
	if (event.type == jevents.noteon && event.velocity !== 0 && event.channel !== 9) {
		if (volume > 1) {
			if (volume % 1 !== 0)
				playNote(keys[event.note - 21 + transpose], (event.velocity / 127) * volume % 1);
			for (let i = 0; i < Math.trunc(volume); i++) {
				playNote(keys[event.note - 21 + transpose], (event.velocity / 127) * 1);
			}
		} else {
			playNote(keys[event.note - 21 + transpose], (event.velocity / 127) * volume);
		}
	} else if (event.type == jevents.noteoff || event.velocity == 0) {
		if (!sustain) stopNote(keys[event.note - 21 + transpose]);
	}
})
player.on('endOfFile', async () => {
	if (looping) {
		setTimeout(() => {
			eventsplayed = 0;
			player.seek(0);
			player.play();
		}, 15)
	} else {
		loadNotes(false);
		send(
			`Finished playing track. Duration: \`${player.songTime.toFixed(2)}s\``,
			`Played \`${eventsplayed}\` out of \`${player.totalEvents}\` (${(eventsplayed / player.totalEvents * 100).toFixed(2)}%) events.`
		);

		player.unload();
		while (Object.keys(playing).length > 0) delete playing[Object.keys(playing)[0]]; // Clear playing
		delete queue[Object.keys(queue)[0]]; // Delete first item in queue
		if (Object.keys(queue).length > 0) {
			setTimeout(() => {
				send(`Downloading next song on the queue... (\`${Object.keys(queue)[0]}\`)`);
				playMIDIfromURL(Object.keys(queue)[0]);
			}, 500);
		} else {
			send('Queue is now empty.');
		}
		eventsplayed = 0;
		keys.forEach(key => {
			stopNote(key);
		})
	}
})

function clearQueue() {
	while (Object.keys(queue).length > 0) delete queue[Object.keys(queue)[0]];
}
function getFileName(URL) {
	try {
		return decodeURIComponent(
			URL.split('/').at(-1)
		).split('.').slice(0, -1).join('.');
	} catch {
		return URL;
	}
}

const queue = {};
const categories = {
	'midi': {
		icon: '🎹',
		label: 'MIDI'
	},
	'info': {
		icon: '📎',
		label: 'Info'
	},
	'pref': {
		icon: '🔧',
		label: 'Preferences'
	}
};
const cmds = {
	help: {
		aliases: ['h'],
		category: 'info',
		about: "Shows a list of categories, a list of commands inside a category, or the info of a specific command.",
		func: (...args) => {
			let ogcmd = args[0];
			if (args.length == 1)
				send(
					`Categories (currently ${public ? 'public' : (clientside ? 'client-side' : 'private')})`,
					createcmdstr(), `Use \`${ogcmd} <categ.>\` to get a list of commands from a specific category.`
				);
			else {
				let categs = [];
				let targetCateg;
				const categ = args[1].toLowerCase();
				for (let i = 0; i < Object.keys(categories).length; i++) {
					const name = Object.keys(categories)[i];
					const info = Object.values(categories)[i];
					categs.push(name.toLowerCase());
					categs.push(info.label.toLowerCase());

					if (categ === info.label.toLowerCase() || categ === name.toLowerCase()) {
						targetCateg = info.label;
					}
				}

				if (categs.includes(categ)) {
					send(
						`Commands in ${targetCateg}`,
						createcmdstr(targetCateg),
						`Use \`${ogcmd} <command>\` to get info about a specific command.`
					);
					return;
				} else if (Object.keys(cmds).includes(args[1])) {
					const cmdinfo = cmds[args[1]];
					const aliases =
						cmdinfo.aliases.length > 0
							? `\`${prefix}${cmdinfo.aliases.join("`, `" + prefix)}\``
							: "*(none)*";

					send(
						`*\`${prefix}${args[1]}\`*`,
						`Category: ${categories[cmdinfo.category].label.toLowerCase()}`,
						`Description: ${cmdinfo.about}`,
						`Aliases: ${aliases}`,
						`Owner only? ${cmdinfo.locked ? 'yes' : 'no'}`
					);
					return;
				} else {
					for (let i = 0; i < Object.keys(cmds).length; i++) {
						const cmd = Object.keys(cmds)[i];
						const info = Object.values(cmds)[i];

						if (info.aliases.includes(args[1])) {
							let aliases =
								info.aliases.length > 0
									? `\`${prefix}${info.aliases.join("`, `" + prefix)}\``
									: "*(none)*";
							send(
								`*\`${prefix}${cmd}\`* (searched for ${args[1]})`,
								`Category: ${categories[info.category].label.toLowerCase()}`,
								`Description: ${info.about}`,
								`Aliases: ${aliases}`,
								`Owner only? ${info.locked ? 'yes' : 'no'}`
							);
							return;
						}
					}
				}
				// fallback
				send("That category (or command) does not exist.");
			}
		}
	},
	about: {
		aliases: ['ab'],
		category: 'info',
		about: "Shows you basic information about this script.",
		func: () => {
			send(`${name} v${version} by ${author}`, `JMIDIPlayer module originally made by seq.wtf`, `Get this userscript at https://greasyfork.org/en/scripts/554578-tealmidiplayer`)
		}
	},
	play: {
		aliases: ['p'],
		category: 'midi',
		about: "Clears the queue and plays a MIDI file from the internet via a link.",
		func: (...args) => {
			let ogcmd = args[0]
			if (args.length === 1)
				send(`Please specify a direct download URL to the desired MIDI file to play.`, `Usage: \`${ogcmd} <URL>\``);
			else {
				let callback = () => {
					clearQueue();
					player.stop();
					keys.forEach(key => {
						stopNote(key);
					})
					send(`Downloading \`${getFileName(args[1])}\`...`);
					queue[getFileName(args[1])] = args[1];
					playMIDIfromURL(getFileName(args[1]));
				}
				if (player.isPlaying)
					setTimeout(callback, 250);
				else
					callback();
			}
		}
	},
	queueup: {
		aliases: ['addtoqueue', 'queuenext', 'next', 'qa', 'qu', 'up', 'addnext', 'nextup', 'nu'],
		category: 'midi',
		about: "Adds a MIDI file link to the track queue.",
		func: async (...args) => {
			let ogcmd = args[0];
			if (args.length === 1)
				send(`Please specify a direct download URL to the desired MIDI file to add to the queue.`, `Usage: \`${ogcmd} <URL>\``);
			else {
				if (Object.keys(queue).length > 0) {
					queue[getFileName(args[1])] = args[1];
					send(`Added \`${getFileName(args[1])}\` to queue.`, `Amount of queued tracks: ${Object.keys(queue).length}`);
					try {
						const r = await fetch(args[1]);
						const arrayBuf = await r.arrayBuffer();
						queue[getFileName(args[1])] = arrayBuf;
					} catch {}
				} else {
					cmds.play.func(...args);
				}
			}
		}
	},
	stop: {
		aliases: ['s'],
		category: 'midi',
		about: "Stops the current track and clears the queue.",
		func: () => {
			if (!player.isLoaded() && !player.isPlaying) {
				send("Nothing to stop.");
				return;
			}

			clearQueue();
			loadNotes(false);
			player.stop();
			player.unload();
			keys.forEach(key => {
				stopNote(key);
			});
			send("Stopped playing.");
		}
	},
	skip: {
		aliases: ['sk'],
		category: 'midi',
		about: "Skips to the next track in the queue.",
		func: () => {
			if (Object.keys(queue).length === 0)
				send('The queue is already empty!');

			else if (Object.keys(queue).length === 1) {
				clearQueue();
				player.stop();
				player.unload();
				keys.forEach(key => stopNote(key));

				send('Skipped track.', 'Queue is now empty.');

			} else if (Object.keys(queue).length > 1) {
				delete queue[Object.keys(queue)[0]];
				player.stop();
				player.unload();
				keys.forEach(key => stopNote(key));
				playMIDIfromURL(Object.keys(queue)[0]);

				setTimeout(() => {
					send('Skipped track.', `Downloading \`${Object.keys(queue)[0]}\`...`);
				}, 250);
			}
		}
	},
	sustain: {
		aliases: ['sus'],
		category: 'midi',
		about: 'Toggles sustain on or off.',
		func: () => {
			sustain = !sustain
			send(`Sustain is now ${sustain ? 'on' : 'off'}.`);
			if (!sustain) {
				keys.forEach(key => {
					stopNote(key);
				})
			}
		}
	},
	volume: {
		aliases: ['vol', 'v'],
		category: 'midi',
		about: "Adjusts the track's volume.",
		func: (...args) => {
			let ogcmd = args[0];
			const minVol = 0, maxVol = 3;
			if (args.length === 1) {
				send(
					`Volume is currently set to \`${volume}\`.`,
					`Please specify a volume to set to.`,
					`Range: \`${minVol.toFixed(1)} to ${maxVol.toFixed(1)}\``,
					`Usage: \`${ogcmd} <volume from ${minVol.toFixed(1)} to ${maxVol.toFixed(1)}>\``
				);
			} else {
				args[1] = parseFloat(args[1]);
				if (args[1] >= minVol && args[1] <= maxVol) {
					volume = args[1];
					send(`Volume set to \`${volume}\`.`);
				} else {
					send(`That value is out of range. Please specify a value between \`${minVol.toFixed(1)}\` and \`${maxVol.toFixed(1)}\`.`);
				}
			}
		}
	},
	speed: {
		aliases: ['sp', 'ps'],
		category: 'midi',
		about: "Changes the playback speed.",
		func: (...args) => {
			let ogcmd = args[0];
			const minSpeed = 0.1, maxSpeed = 2;
			if (args.length === 1) {
				send(`Playback speed is currently set to \`x${player.playbackSpeed} (${Math.trunc(player.playbackSpeed * 100)}%)\`.`, `Please specify a speed to set to.`, `Range: \`x${minSpeed.toFixed(1)} (${minSpeed * 100}%) to ${maxSpeed.toFixed(1)}x (${maxSpeed * 100}%)\``, `Usage: \`${ogcmd} <value from ${minSpeed.toFixed(1)} to ${maxSpeed.toFixed(1)}>\``);
			} else {
				args[1] = parseFloat(args[1]);
				if (args[1] >= minSpeed && args[1] <= maxSpeed) {
					player.playbackSpeed = args[1];
					send(`Playback speed set to \`x${player.playbackSpeed} (${Math.trunc(player.playbackSpeed * 100)}%)\`.`);
				} else {
					send(`That value is out of range. Please specify a value between \`${minSpeed.toFixed(1)}\` and \`${maxSpeed.toFixed(1)}\`.`);
				}
			}
		}
	},
	toggle: {
		aliases: ['to', 'pause', 'pa'],
		category: 'midi',
		about: "Switches between pausing and playing a track.",
		func: () => {
			if (player.isLoaded()) {
				if (player.isPlaying) {
					player.pause();
					keys.forEach(key => {
						stopNote(key);
					})
					send("Paused track.");
				} else {
					player.play();
					send("Resumed track.");
				}
			} else send("Nothing loaded yet.");
		}
	},
	resume: {
		aliases: ['re'],
		category: 'midi',
		about: "Resumes a track.",
		func: () => {
			if (player.isLoaded()) {
				player.play();
				send("Resumed track.");
			} else send("Nothing loaded yet.");
		}
	},
	transpose: {
		aliases: ['tr'],
		category: 'midi',
		about: "Changes the transposition (key) of the current track.",
		func: (...args) => {
			let ogcmd = args[0];
			if (args.length === 1)
				send(`Transposition (key) is currently set to \`${transpose}\`.`, `Please specify a value between \`-24\` and \`36\`.`, `Usage: \`${ogcmd} <value>\``);
			else {
				args[1] = parseInt(args[1]);
				if (isNaN(args[1]))
					send("Please specify a *number*.");
				else
					if (args[1] > 36 || args[1] < -24)
						send("Please specify a value under `36` and above `-24`.");
					else {
						transpose = args[1];
						send(`Transposition (key) is now set to \`${transpose}\`.`);
					}
			}
		}
	},
	loop: {
		aliases: ['l'],
		category: 'midi',
		about: "Toggles between looping and not looping.",
		func: () => {
			looping = !looping;
			if (looping) send("Now looping track.");
			else send("Stopped looping track.");
		}
	},
	track: {
		aliases: ["t"],
		category: 'info',
		about: "Shows info about the track that's currently playing.",
		func: () => {
			if (player.isLoaded()) {
				// format progress bar
				let remaining = ((currenttick * (60 * 1000 / (player.currentTempo * player.ppqn)) / 1000) / player.songTime) * 100;
				let progressbar = [];
				for (let i = 0; i < Math.trunc(remaining / 10); i++) {
					progressbar.push('█');
				}

				// define song time info
				let secondsstr = "";
				let played = currenttick * (60 * 1000 / (player.currentTempo * player.ppqn)) / 1000;
				let playedsecondsstr = "";
				let songtime = player.songTime;

				// format song time
				if (songtime % 60 > 0) secondsstr = ` ${parseInt(songtime % 60)}s`;
				if (played % 60 > 0) playedsecondsstr = ` ${parseInt(played % 60)}s`;

				// format song length
				let length =
					songtime > 60
						? `${parseInt(songtime / 60)}m ${secondsstr}`
						: `${songtime.toFixed(3)}s`;
				let lengthplayed =
					played > 60
						? `${parseInt(played / 60)}m ${playedsecondsstr}`
						: `${played.toFixed(3)}s`;

				// aliases
				let totalevents = player.totalEvents;
				let bpm = Math.trunc(player.currentTempo);
				let playbackspeed = player.playbackSpeed;


				// dayum, he chonkeh!
				send(
					`\`${(player.isLoaded() && !player.isPlaying) ? `PAUSED ${sep} ` : ''}[${progressbar.join('').padEnd(10, " ")}]`,
					`${remaining.toFixed(2)}% (${lengthplayed}) played`,
					`Track name: ${playing.name}`,
					`Track BPM: ${bpm}`,
					`Track length: ${length}`,
					`Played ${eventsplayed} out of ${totalevents} events (${(eventsplayed / totalevents).toFixed(2)}%)`,
					`Looping: ${looping ? 'yes' : 'no'}`,
					`Playback speed: x${playbackspeed} (${Math.trunc(playbackspeed * 100)}%)\``
				);
			} else send("Nothing loaded yet.");
		}
	},
	notequota: {
		aliases: ['nq'],
		category: 'info',
		about: "Shows NoteQuota status.",
		func: () => {
			send(`Maximum points: ${MPP.noteQuota.max}\nCurrent points: ${MPP.noteQuota.points} (${Math.trunc((MPP.noteQuota.points / MPP.noteQuota.max) * 100)}%)`);
		}
	},
	queue: {
		aliases: ['q'],
		category: 'info',
		about: "Shows the list of queued tracks.",
		func: () => {
			const qFormatted = [];
			for (const queued of Object.keys(queue)) {
				qFormatted.push(queued);
			}
			send(`[${Object.keys(queue).length}] Queue${looping ? " (currently looping, won't go to next)" : ''}: ${Object.keys(queue).length > 0 ? `\`${qFormatted.join('`, `')}\`` : '*(empty)*'}`);
		}
	},
	prefix: {
		locked: true,
		aliases: ['pre'],
		category: 'pref',
		about: "Defines the prefix of the MIDI player.",
		func: (...args) => {
			if (args.length <= 1) {
				send(`Prefix is currently set to \`${prefix}\`.`, "Please specify a prefix to set to. (Note: anything in the prefix that's after a space is ignored.)");
			} else {
				if (args[1].length >= 40) {
					send(`Prefix too long! (wanted less than 40 characters, but got ${args[1].length} characters instead)`);
					return;
				}
				localStorage.tmp_prefix = prefix = args[1].toLowerCase();
				send(`Prefix is now set to ${prefix === '' ? 'nothing' : `\`${prefix}\``}. Use \`${prefix}help\` to see commands.`);
			}
		}
	},
	public: {
		locked: true,
		category: 'pref',
		aliases: ['pub', 'pu'],
		about: "Toggles between commands being public or private.",
		func: () => {
			if (clientside) {
				send('You cannot make the bot public while it is client-side only.');
				return;
			}
			public = localStorage.tmp_public = !public;
			send(`Commands are now ${public ? 'public' : 'private'}.`);
		}
	},
	clientside: {
		locked: true,
		category: 'pref',
		aliases: ['cs', 'client'],
		about: "Toggles between commands and notes only being visible to you or being visible to everyone.",
		func: () => {
			if (public) {
				send("Please make the bot private before changing it to client-side only.");
				return;
			}
			localStorage.tmp_clientside = clientside = !clientside;
			if (clientside)
				send("The bot is now client-side only. This means only you will be able to see the bot's messages and notes.");
			else
				send("The bot is now publicly visible. Everyone will now be able to see the bot's messages and notes.");
		}
	},
	checkupdate: {
		locked: true,
		category: 'pref',
		aliases: ['updatecheck', 'updates', 'update', 'check', 'upd', 'chk'],
		about: "Checks for updates.",
		func: async () => {
			const status = await checkUpdate(false, true);
			switch (status) {
				case 'stable':
					send(`You are using a stable version of ${name} (${version}). `);
					break;
				case 'outdated':
					send(`You are using an outdated version of ${name} (${version}). Please update here: https://greasyfork.org/scripts/554578-tealmidiplayer`);
					break;
				case 'beta':
					send(`You are using an unreleased version of ${name} (${version}). Expect instability and bugs.`);
					break;
				case 'unknown': case 'devtools':
					send(`You are running TealMIDIPlayer outside of a userscript environment (like DevTools), therefore your version number cannot be determined.`);
					break;

				default:
					send(`Unknown update status "${status}"`);
					break;
			}
		}
	}
}
for (const [name, info] of Object.entries(categories)) {

}

function createcmdstr(categ) {
	if (categ == null) {
		const result = [];

		for (const [name, info] of Object.entries(categories))
			// expected output: "<categ. emoji> <categ. label/name> (`<categ internal name>`)"
			result.push(`${info.icon} ${info.label} (\`${name}\`)`);

		return result.join(', ');
	} else {
		categ = categ.toLowerCase();

		let targetCateg;
		const categs = [];
		for (const [name, info] of Object.entries(categories)) {
			categs.push(name.toLowerCase());
			categs.push(info.label.toLowerCase());

			if (categ === info.label.toLowerCase() || categ === name.toLowerCase())
				targetCateg = name;
		}

		if (!categs.includes(categ)) return defaultMsgs.categs.invalid;

		const result = [];
		for (const [cmd, cmdinfo] of Object.entries(cmds)) {
			// Skip command if its category isn't the target category
			if (cmdinfo.category !== targetCateg) continue;

			// Expected output: "`;<cmd>`"
			let str = `\`${prefix + cmd}\``;
			// Expected output: "`;<cmd>` (`;<alias>`)"
			// or alternatively: "`;<cmd>` (`;<alias1>`, `;<alias2>`, ...)"
			if (cmdinfo.aliases.length > 0) {
				str += ` (\`${prefix + cmdinfo.aliases.join(`\`, \`${prefix}`)}\`)`;
			}

			result.push(str);
		}

		return result.join(', ');
	}
}

if (!localStorage.getItem('tmp_public')) localStorage.tmp_public = 'false';
let public = localStorage.tmp_public === 'true';
if (clientside && public) localStorage.tmp_clientside = clientside = false;
const defaultMsgs = {
	cmd: {
		noperms: 'You do not have permission to use this command.',
		notfound: `The command \`{cmd}\` does not exist. Use \`${prefix}help\` to see the categories of commands you can use.`,
	},
	categs: {
		invalid: 'Invalid category',
	}
}
const chatMessageHandler = async data => {
	if (!public && data.p._id !== MPP.client.getOwnParticipant()._id) return;
	const args = data.a.split(' ');
	let cmd = args[0].toLowerCase();

	if (cmd.startsWith(prefix)) {
		cmd = cmd.substring(prefix.length);
		if (cmd === '') return; // Empty command

		// Find command
		let targetCmd = cmd;
		if (cmds[targetCmd] == null)
			targetCmd = Object.entries(cmds).find(([c, m]) => (m.aliases ?? []).includes(cmd))?.[0];
		if (cmds[targetCmd] == null) {
			send(defaultMsgs.cmd.noperms.replace('{cmd}', prefix + cmd));
			return;
		}

		// Check permissions and execute command
		targetCmd = cmds[targetCmd];
		if (targetCmd.locked && data.p._id !== MPP.client.getOwnParticipant()._id) {
			send(defaultMsgs.cmd.noperms);
			return;
		}
		await targetCmd.func(...args);
	}
}
MPP.client.on('a', chatMessageHandler);

// custom msg handler
MPP.client.sendArray([{ m: "+custom" }]);
MPP.client.on('custom', (evtn) => {
	const data = evtn.data;
	if (data.script !== 'tmp') return;
	switch (data.type) {
		case 'ann.':
			notif(`<h2>Announcement</h2><br>${typeof data.text === 'string' ? data.text : '<missing>'}<br><small>(click to close)</small>`, true, 60e3);
			break;

		default:
			console.log(`unknown notif "${data.type}"`, data);
			break;
	}
})

// set to utf-8
let metaTag = document.createElement('meta');
metaTag.charset = 'UTF-8';
document.head.prepend(metaTag);

// notif API
function notif(html, clickable = false, timeout = 15e3) {
	let notif = document.createElement('p');
	notif.innerHTML = html;
	notif.style.cssText = `
		color: #fff;
		background-color: #666a;
		box-shadow: 0px 0px 15px 5px #0008;
		backdrop-filter: saturate(150%) blur(16px);
		font-size: 24px;
		font-family: Arial, monospace;
		padding: 5px;
		margin: 15px;
		border-radius: 10px;
		position: fixed;
		left: 50%;
		transform: translate(-50%, -200%);
		transition: opacity 1s ease, transform .75s ease;
		white-space: pre;
		z-index: calc(infinity);
		text-align: center;
		cursor: ${clickable ? 'pointer' : 'default'};
	`;
	const hidenotif = () => {
		if (!notif.isConnected) return;
		notif.style.opacity = "0%";
		notif.style.transform = "translate(-50%, -100%)";
		setTimeout(() => {
			notif.remove();
		}, 1.5e3)
	}
	if (clickable) notif.onmousedown = hidenotif;
	document.body.prepend(notif);
	setTimeout(() => {
		notif.style.transform = "translate(-50%, 0%)";
		setTimeout(hidenotif, timeout);
	}, 50)
	return notif;
}

// load notif
const loadNotif = notif(
	`<b>${name} by ${author}</b> loaded.\nUse <b><i>${prefix}</i>help</b> to see commands${public ? ' <i>(Commands are currently public!)</i>' : ''}.\n<small><i>(click to close popup)</i></small>`,
	true,
	5e3
);


// update check
async function checkUpdate(isInterval, silent = false) {
	let r;
	try {
		// try using main url
		r = await fetch(`https://update.greasyfork.org/scripts/554578/JMIDIPlayer.user.js?nocache=${Math.random()}`);
	} catch {
		// use backup url if blocked
		r = await fetch(`https://update.greasyfork.org/scripts/554578/TealMIDIPlayer.user.js?nocache=${Math.random()}`);
	}

	const code = (await r.text()).split('\n');
	for (const line of code) {
		if (!line.startsWith('//')) continue; // This is not a comment. All userscript headers are required to be comments!
		if (line.includes('@version')) {
			let versionNum = line.split(' ');
			versionNum = versionNum[versionNum.length - 1];
			let splitNewNum = versionNum.split('.');
			let splitMyNum = version.split('.');

			let result = 'j';
			let results = [];
			for (let i = 0; i < splitMyNum.length; i++) {
				const newNum = parseInt(splitNewNum[i]);
				const myNum = parseInt(splitMyNum[i]);
				if (myNum === newNum)
					results.push('=');
				else if (myNum > newNum)
					results.push('>');
				else if (myNum < newNum)
					results.push('<');
				else
					results.push('?');
			}
			const isBeta = results.includes('>') && (results.includes('<') ? (results.indexOf('>') < results.indexOf('<')) : true),
				isOutdated = results.includes('<') && (results.includes('>') ? (results.indexOf('<') < results.indexOf('>')) : true),
				isStable = results.includes('=') && !results.includes('<') && !results.includes('>'),
				isDevTools = embedded;

			if (isDevTools)
				result = 'unknown';
			else if (isBeta)
				result = 'beta';
			else if (isOutdated)
				result = 'outdated';
			else if (isStable)
				result = 'stable';
			else result = 'indeterminable'

			if (silent) return result;


			const callback = () => {
				let notifMsg;
				switch (result) {
					case 'outdated':
						notifMsg = `Your script is <b>outdated!</b>\nNewest version: ${versionNum} - Your version: ${version}\nPlease <a href='https://greasyfork.org/en/scripts/554578-tealmidiplayer' target='_blank'>update your script here</a>.`;
						break;
					case 'beta':
						if (!isInterval)
							notifMsg = `You are using an unreleased version of <b>${name}</b>.\nExpect instability and bugs.`;
						break;
					case 'unknown': case 'devtools':
						if (!isInterval)
							notifMsg = `You are using ${name} on a non-userscript environment.\nSome features may be broken.`;
						break;
					default: notifMsg = null; break;
				}
				if (notifMsg == null || silent) return;
				if (isInterval) {
					const closeTime = 15e3;
					notif(
						notifMsg + `\n<small><i>(This popup will automatically close in ${closeTime / 1e3} seconds.)</i></small>`,
						false, closeTime
					);

				} else {
					const closeTime = 5e3;
					notif(
						notifMsg + `\n<small><i>(Click to close this popup. This popup will also automatically close in ${closeTime / 1e3} seconds.)</i></small>`,
						true, closeTime
					);
				}
			}

			if (loadNotif.isConnected) {
				const msgint = setInterval(() => {
					if (loadNotif.isConnected) return;
					callback();
					clearInterval(msgint);
				}, .5e3);
			} else callback();

			break; // The version was checked. We can break out of this loop now!
		}

		if (line.startsWith('// ==/UserScript==')) break; // The footer was reached. No useful information will be found here.
	}
	return code;
}
checkUpdate();
const updateCheckInterval = setInterval(() => checkUpdate(true), 120e3);
