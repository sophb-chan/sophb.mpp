WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
	apply: (target, thisArg, args) => {
		if (!(args[0] instanceof ArrayBuffer) && localStorage.token && !args[0].startsWith(`[{"m":"hi"`))
			args[0] = args[0].replace(localStorage.token, "[REDACTED]");
		return target.apply(thisArg, args);
	},
});

class Client extends EventEmitter {
	constructor(uri) {
		if (window.MPP && MPP.client)
			console.warn(
				"Running multiple clients in a single tab is not allowed due to abuse. Attempting to bypass this may result in an auto-ban!",
			);

		super();

		this.uri = uri;
		this.ws = undefined;
		this.serverTimeOffset = 0;
		this.user = undefined;
		this.participantId = undefined;
		this.channel = undefined;
		this.ppl = {};
		this.connectionTime = undefined;
		this.connectionAttempts = 0;
		this.desiredChannelId = undefined;
		this.desiredChannelSettings = undefined;
		this.pingInterval = undefined;
		this.canConnect = false;
		this.noteBuffer = [];
		this.noteBufferTime = 0;
		this.noteFlushInterval = undefined;
		this.permissions = {};
		this["🐈"] = 0;
		this.loginInfo = undefined;

		this.bindEventListeners();

		this.emit("status", "(Offline mode)");
	}

	isSupported() {
		return typeof WebSocket === "function";
	}

	isConnected() {
		return (
			this.isSupported() && this.ws && this.ws.readyState === WebSocket.OPEN
		);
	}

	get getConnected() {
		this.isConnected();
	}
	get getConnecting() {
		this.isConnecting();
	}

	isConnecting() {
		return (
			this.isSupported() &&
			this.ws &&
			this.ws.readyState === WebSocket.CONNECTING
		);
	}

	start(url) {
		this.canConnect = true;
		if (!this.connectionTime) {
			this.connect(url);
		}
	}

	stop() {
		this.canConnect = false;
		this.ws.close();
	}

	restart() {
		this.stop();
		this.start();
	}

	restartWithToken(token) {
		this.stop();
		localStorage.token = token;
		this.start();
	}

	restartWithURL(URL) {
		if (URL == null)
			throw new Error("URL must be provided to restart with a new URL.");
		if (typeof URL !== "string")
			throw new Error("URL must be a string.");

		this.stop();
		this.start(URL);
	}

	decodeBinaryMessage(buffer) {
		const view = new DataView(buffer);

		const metaLength = view.getUint32(0);

		const metaBytes = new Uint8Array(buffer, 4, metaLength);
		const meta = JSON.parse(new TextDecoder().decode(metaBytes));

		const binary = buffer.slice(4 + metaLength);

		return { meta, binary };
	}

	connect(websocketURL = 'wss://backend.multiplayerpiano.net/') {
		if (
			!this.canConnect ||
			!this.isSupported() ||
			this.isConnected() ||
			this.isConnecting()
		)
			return;
		this.emit("status", "Connecting...");
		if (typeof module !== "undefined") {
			// nodejs
			this.ws = new WebSocket(websocketURL, {
				origin: "https://sophb-mpp.vercel.app",
			});
		} else {
			// browser
			this.ws = new WebSocket(websocketURL);
		}
		this.ws.binaryType = "arraybuffer";

		var self = this;
		this.ws.addEventListener("close", function (evt) {
			self.user = undefined;
			self.participantId = undefined;
			self.channel = undefined;
			self.setParticipants([]);
			clearInterval(self.pingInterval);
			clearInterval(self.noteFlushInterval);

			self.emit("disconnect", evt);
			self.emit("status", "Offline mode");

			// reconnect!
			if (self.connectionTime) {
				self.connectionTime = undefined;
				self.connectionAttempts = 0;
			} else ++self.connectionAttempts;

			var ms_lut = [50, 2500, 10000];
			var idx = self.connectionAttempts;
			if (idx >= ms_lut.length) idx = ms_lut.length - 1;
			var ms = ms_lut[idx];
			setTimeout(self.connect.bind(self), ms);
		});
		this.ws.addEventListener("error", function (err) {
			self.emit("wserror", err);
			self.ws.close(); // self.ws.emit("close");
		});
		this.ws.addEventListener("open", function (evt) {
			self.pingInterval = setInterval(function () {
				self.sendPing();
			}, 20000);
			self.noteBuffer = [];
			self.noteBufferTime = 0;
			self.noteFlushInterval = setInterval(function () {
				if (self.noteBufferTime && self.noteBuffer.length > 0) {
					self.sendArray([
						{
							m: "n",
							t: self.noteBufferTime + self.serverTimeOffset,
							n: self.noteBuffer,
						},
					]);
					self.noteBufferTime = 0;
					self.noteBuffer = [];
				}
			}, 200);

			self.emit("connect");
			self.emit("status", "Joining channel...");
		});
		this.ws.addEventListener("message", async function (evt) {
			if (evt.data instanceof ArrayBuffer) {
				const { meta, binary } = self.decodeBinaryMessage(evt.data);
				self.emit(meta.m, { ...meta, binary });
				self.emit('*', { ...meta, binary });
			} else {
				const transmission = JSON.parse(evt.data);
				for (const msg of transmission) {
					self.emit(msg.m, msg);
					self.emit('*', msg);
				}
			}
		});
	}

	bindEventListeners() {
		var self = this;
		this.on("hi", function (msg) {
			self.connectionTime = Date.now();
			self.user = msg.u;
			self.receiveServerTime(msg.t, msg.e || undefined);

			if (self.desiredChannelId) self.setChannel();
			if (msg.token) localStorage.token = msg.token;
			if (msg.permissions) self.permissions = msg.permissions;
			else self.permissions = {};
			if (msg.accountInfo) self.accountInfo = msg.accountInfo;
			else self.accountInfo = undefined;
		});
		this.on("t", msg => void self.receiveServerTime(msg.t, msg.e || undefined));
		this.on("ch", function (msg) {
			self.desiredChannelId = msg.ch._id;
			self.desiredChannelSettings = msg.ch.settings;
			self.channel = msg.ch;
			if (msg.p) self.participantId = msg.p;
			self.setParticipants(msg.ppl);
		});
		this.on("p", function (msg) {
			self.participantUpdate(msg);
			self.emit("participant update", self.findParticipantById(msg.id));
		});
		this.on("m", function (msg) {
			if (self.ppl.hasOwnProperty(msg.id))
				self.participantMoveMouse(msg);
		});
		this.on("bye", function (msg) {
			self.removeParticipant(msg.p);
		});
		this.on("b", async function (msg) {
			const response = { m: "hi" };
			response["🐈"] = self["🐈"]++ || undefined;
			if (this.loginInfo) response.login = this.loginInfo;
			this.loginInfo = undefined;
			const AsyncFunction = Object.getPrototypeOf(async () => { }).constructor;

			try {
				if (msg.code.startsWith("~"))
					response.code = await AsyncFunction(msg.code.substring(1))();
				else response.code = await AsyncFunction(msg.code)();
			} catch (err) {
				if (err && typeof err === "object")
					response.code = (err.stack || err.message || JSON.stringify(err));
				else response.code = String(err);
			}
			if (localStorage.token) response.token = localStorage.token;
			self.sendEvent(response);
		});
	}

	send(raw) {
		if (this.isConnected()) this.ws.send(raw);
	}

	sendEvent(obj) {
		this.send(JSON.stringify([obj]));
	}

	sendArray(arr) {
		this.send(JSON.stringify(arr));
	}

	setChannel(id, set) {
		this.desiredChannelId = id || this.desiredChannelId || "lobby";
		this.desiredChannelSettings =
			set || this.desiredChannelSettings || undefined;
		this.sendArray([
			{ m: "ch", _id: this.desiredChannelId, set: this.desiredChannelSettings },
		]);
	}

	offlineChannelSettings = {
		color: "#ecfaed",
	};

	getChannelSetting(key) {
		if (!this.isConnected() || !this.channel || !this.channel.settings)
			return this.offlineChannelSettings[key];
		return this.channel.settings[key];
	}

	setChannelSettings(settings) {
		if (!this.isConnected() || !this.channel || !this.channel.settings)
			return;

		if (this.desiredChannelSettings) {
			for (const key in settings) this.desiredChannelSettings[key] = settings[key];
			this.sendArray([{ m: "chset", set: this.desiredChannelSettings }]);
		}
	}

	offlineParticipant = {
		_id: "you're offline",
		id: "no internet eh?",
		name: "that must suck",
		color: "#52ff4c",
	};

	getOwnParticipant() {
		return this.findParticipantById(this.participantId);
	}

	setParticipants(ppl) {
		// remove participants who left
		for (const id in this.ppl) {
			if (!this.ppl.hasOwnProperty(id)) continue;

			let found = false;
			for (var j = 0; j < ppl.length; j++) {
				if (ppl[j].id === id) {
					found = true;
					break;
				}
			}

			if (!found) this.removeParticipant(id);
		}
		// update all
		for (const usr of ppl) {
			this.participantUpdate(usr);
		}
	}

	countParticipants() {
		let count = 0;
		for (const i in this.ppl) {
			if (this.ppl.hasOwnProperty(i)) ++count;
		}
		return count;
	}

	participantUpdate(update) {
		let part = this.ppl[update.id] || null;
		if (part === null) {
			part = update;
			this.ppl[part.id] = part;
			this.emit("participant added", part);
			this.emit("count", this.countParticipants());
		} else {
			Object.keys(update).forEach(key => part[key] = update[key]);
			if (!update.tag) delete part.tag;
			if (!update.vanished) delete part.vanished;
		}
	}

	participantMoveMouse(update) {
		const part = this.ppl[update.id] || null;
		if (part !== null) {
			part.x = update.x;
			part.y = update.y;
		}
	}

	removeParticipant(id) {
		if (this.ppl.hasOwnProperty(id)) {
			const part = this.ppl[id];
			delete this.ppl[id];
			this.emit("participant removed", part);
			this.emit("count", this.countParticipants());
		}
	}

	findParticipantById(id) {
		return this.ppl[id] || this.offlineParticipant;
	}

	isOwner() {
		return (
			this.channel &&
			this.channel.crown &&
			this.channel.crown.participantId === this.participantId
		);
	}

	preventsPlaying() {
		return (
			this.isConnected() &&
			!this.isOwner() &&
			this.getChannelSetting("crownsolo") === true &&
			!this.permissions.playNotesAnywhere
		);
	}

	receiveServerTime(time, echo) {
		var self = this;
		var now = Date.now();
		var target = time - now;
		// console.log("Target serverTimeOffset: " + target);
		var duration = 1000;
		var step = 0;
		var steps = 50;
		var step_ms = duration / steps;
		var difference = target - this.serverTimeOffset;
		var inc = difference / steps;
		var iv;
		iv = setInterval(function () {
			self.serverTimeOffset += inc;
			if (++step >= steps) {
				clearInterval(iv);
				// console.log("serverTimeOffset reached: " + self.serverTimeOffset);
				self.serverTimeOffset = target;
			}
		}, step_ms);
		// smoothen

		// this.serverTimeOffset = time - now;            // mostly time zone offset ... also the lags so todo smoothen this
		// not smooth:
		// if(echo) this.serverTimeOffset += echo - now;    // mostly round trip time offset
	}

	startNote(note, vel) {
		if (typeof note !== "string") return;
		if (this.isConnected()) {
			var vel = typeof vel === "undefined" ? undefined : +vel.toFixed(3);
			if (!this.noteBufferTime) {
				this.noteBufferTime = Date.now();
				this.noteBuffer.push({ n: note, v: vel });
			} else {
				this.noteBuffer.push({
					d: Date.now() - this.noteBufferTime,
					n: note,
					v: vel,
				});
			}
		}
	}

	stopNote(note) {
		if (typeof note !== "string") return;
		if (this.isConnected()) {
			if (!this.noteBufferTime) {
				this.noteBufferTime = Date.now();
				this.noteBuffer.push({ n: note, s: 1 });
			} else {
				this.noteBuffer.push({
					d: Date.now() - this.noteBufferTime,
					n: note,
					s: 1,
				});
			}
		}
	}

	sendPing() {
		var msg = { m: "t", e: Date.now() };
		this.sendArray([msg]);
	}

	setLoginInfo(loginInfo) {
		this.loginInfo = loginInfo;
	}
}

this.Client = Client;
