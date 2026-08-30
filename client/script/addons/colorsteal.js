// ==UserScript==
// @name         colorsteal
// @namespace    <gone>
// @version      2.0.0
// @description  it's in the name
// @author       sophb.chan
// @match        *://multiplayerpiano.org/*
// @match        *://multiplayerpiano.net/*
// @match        *://piano.mpp.community/*
// @match        *://multiplayerpiano.dev/*
// @match        *://mpp.8448.space/*
// @match        *://mpp.smp-meow.net/*
// @match        *://sophb-mpp.vercel.app/*
// @license      MIT
// @icon         data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsSAAALEgHS3X78AAAAAXNSR0IArs4c6QAAAnpJREFUeF7tmlFShDAMhrfjDdRX9XLO6JH0ePqsZ8AJM2FiJ23DJiTAxhdZKIV8Tf4kQJmmabrc8F9JAOkBGQKpATesgZcUwcwCnSxQSmGj40yJoxkCYPyZDG3p3KYAjgAxAbRE0GL1LObYOkWrPaAWSqobNQDJWBzjpT8qANwK032tbVzV+jjs9zJ8uQdNCFgD8DYeIOzKAxJAQGPa7QUklaBE2GjMU1XvCebW6j/UAK8biL5OdoOR3SAXYt5CGOYBEVUim7ajPCABBLTbh/QAS0/ZFYC5DGWeONW1AaZJ3N+rO7g5R7VGmAg2n9BUobG2oaqzyPB8rQj+fn4Pa5mHt+fhGK5DxBVtrT7nHa4AJMbjTUohcM8QKIBenbCmO1WXwmg8GAbb+L+31BIIhwMABnPGc2BqACMRrENgrXCKQuRaDaDuTwG0thGUWAycBqqywBYa4GT3chkVAJhFAuHx/eWfXd4NTw+qGoBkxUbFi2SOrca4A4DVtyxvtWBcAfx8fM33C0K5FwguAGiVtzcIrgAwjyME+A0CGSmKIQDAcIQAACiQUUxLqsnRHPS4OwBMnZga1xi/tq+QgHAHIKkbRjde7srl/vVpNEx0PBwAunTdXLV6DGsvCAUwaqLQWM5rrLRgtwBO6wF1/0BDoPaI1jMGq9Wf0/K17bBIYTqDrhVDS+NDAWgBWp0f5gFWBmjnSQBRGqBdOavz0wPSAyJ7USs/VsyTIZAhkCHQ/jqx9bIRQu4s3LqfytaGjt61K7Qo7FQWABqqeVMbZtHKC88AJAbPnRP5emMvz/Wl9nKf5i/d4C0BqG1dQqD3dQVH70giiO8m6Ws5tOkPIuP6YibZoUkAAAAASUVORK5CYII=
// @grant        GM_info
// ==/UserScript==

(() => {
	const GMinfo = (() => {
		try {
			return GM_info;
		} catch {
			return {
				script: {
					name: "colorsteal",
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
		author,
		version
	} = GMinfo.script;


	function findUser(query) {
		const normalize = s => s
			.normalize('NFKD')
			.replaceAll(/[\u0300-\u036f]/g, "")
			.replaceAll(/(\s)\1+/g, '$1')
			.toLowerCase();

		const normalizedQuery = normalize(query);
		return Object.values(MPP.client.ppl).find(p => {
			const id = normalize(p.id || p._id);
			const name = normalize(p.name);
			return id.includes(normalizedQuery)
				||
				name.includes(normalizedQuery);
		});
	}
	function getPpl() {
		const IDs = [], names = [];
		for (const user of Object.values(MPP.client.ppl)) {
			const userID = (user._id || user.id).slice(0, 6);
			IDs.push(userID);
			names.push(user.name);
		}
		return {
			IDs, names
		};
	}
	function blendColors(colorA, colorB, amount) {
		const shortHexRegex = /#([a-f0-9])([a-f0-9])([a-f0-9]))/g,
			hexRegex = /#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2}))/g;
		const matchHex = c => (shortHexRegex.exec(c) ?? hexRegex.exec(c)).map(v => v.padStart(2, v));
		const lerp = (a, b, t) => a * (1 - t) + b * t;
		const
			[mA, rA, gA, bA] = matchHex(colorA),
			[mB, rB, gB, bB] = matchHex(colorB);
		const
			r = lerp(rA, rB, amount),
			g = lerp(gA, gB, amount),
			b = lerp(bA, bB, amount);
		return '#' + r+g+b;
	}

	MPP.client.on('hi', function () {
		if (localStorage.hasUsedColorstealBefore == null) {
			setTimeout(function () {
				const colorsteal = {
					_id: 'colors',
					id: 'colors',
					color: '#8324f3',
					name: 'Colorsteal',
				};

				const rando = Object.values(MPP.client.ppl)[Math.random() * Object.keys(MPP.client.ppl).length << 0].name;
				MPP.chat.receive({
					m: "a",
					t: Date.now(),
					a: "Thanks for using colorsteal! To get a list of commands you can try after installing this bot, use `help`. You don't need to provide any information for this bot, the needed info will be stored after sending a message..",
					p: colorsteal,
				});
				MPP.chat.receive({
					m: "a",
					t: Date.now(),
					a: `You can for example, steal the color from,,, let me pick,, uhh... you can steal the color from ${rando.name} by using \`steal ${rando.name}\` or \`steal ${rando.color}\`! ─ You can also set your color to a random one with \`shuffle\`, and if you like it, favorite it using \`fave\`!`,
					p: colorsteal,
				});
				MPP.chat.receive({
					m: "a",
					t: Date.now(),
					a: "Don't worry by the way! Only you can see these messages, and this won't happen again. Have fun using my bot! <3",
					p: colorsteal,
				});
				localStorage.hasUsedColorstealBefore = true;
			}, 5e3);
		}
	});
	const ball = {
		"It is certain": false,
		"It is decidedly so": false,
		"Without a doubt": false,
		"Yes definitely": false,
		"You may rely on it": false,
		"As I see it, yes": false,
		"Most likely": false,
		"Outlook good": false,
		"Yes": false,
		"Signs point to yes": false,
		"Reply hazy, try again": true,
		"Ask again later": true,
		"Better not tell you now": true,
		"Cannot predict now": true,
		"Concentrate and ask again": true,
		"Don't count on it": false,
		"My reply is no": false,
		"My sources say no": false,
		"Outlook not so good": false,
		"Very doubtful": false,
	};

	// Set localStorage defaults
	localStorage.help ??= true;
	localStorage.counter ??= 0;

	function send(msg) {
		MPP.chat.send(msg);
	}
	function receive(userdata, msg) {
		MPP.chat.receive({
			"m": "a",
			"t": Date.now(),
			'a': msg,
			"p": {
				"_id": userdata._id,
				"name": userdata.name,
				"color": userdata.color,
				"id": userdata._id
			}
		});
	}

	const cmds = {
		add: {
			public: true,
			desc: "Increase the counter!",
			fn() {
				localStorage.counter = parseInt(localStorage.counter) + 1;
				send('Counter:', localStorage.counter);
			}
		},
		reverse: {
			desc: "Reverses the text you give it.",
			fn({
				substring,
			} = {}) {
				const toBeReversed = substring(1) || "Look ma! I'm not giving any text to the `reverse` command!";
				send(`"${toBeReversed}" in reverse is "${[...toBeReversed].reverse().join('')}"`);
			}
		},
		checkVersion: {
			fn() {
				if (window.navigator.onLine) checkVersionManual();
				else {
					receive({
						color: "#ff4747",
						name: "System",
						_id: "system",
						id: "systemsystemsystemsystem"
					}, "You are offline. Try checking your version when you're back online.")
				}
			}
		},
		/*
		cmd: {
			fn({
				substring,
				args,
			} = {}) {
			}
		},
		*/
	}
	MPP.client.on('a', function (m) {
		const args = m.a.split(' ');
		const cmd = args[0].toLowerCase();
		const hasCrown = (
			'crown' in MPP.client.channel &&
			MPP.client.channel.crown.userId === MPP.client.getOwnParticipant()._id
		);
		const public = false;
		const randroom = "Room" + Math.floor(Math.random() * 1e12);
		const randomhex = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
		const colorname = function (hex) { if (new Color(hex).getName().length > 10) { return new Color(hex).getName().substring(10).trim() } else { return new Color(hex).getName() } }
		const shitpost = shitposts[Math.floor(Math.random() * shitposts.length)]
		// cmds
		localStorage.resetname ??= MPP.client.getOwnParticipant().name;
		localStorage.resetcolor ??= MPP.client.getOwnParticipant().color;

		if (cmd == "help") {
			if (localStorage.help) {
				if (args.length == 1) {
					send("Please choose a category: userset, info, fun, other - Do `help <category>` to access a category.") // or use `help usage [command name]` to get the usage of a command - but that doesn't actually work
				} else if (args.length == 2) {
					if (args[1] == "userset") {
						send("Commands: steal - steals color from ID | color - sets color to hex | name - sets name | shuffle - makes you a random color | reset - resets you to your defaults | stat - this command sets a status for you")
					} else if (args[1] == "info") {
						send("Commands: mycolor - tells you your current color | settings - sends room settings to chat | about - info about bot or info about user | help - lists commands | define - defines a variable | whereami - tells you the room name | chown - tells you who is holding crown | checkversion - checks your version")
					} else if (args[1] == "fun") {
						send("Commands: flip - flips or fails | shitpost - sends a shitpost | merge - merges 2 colors | mergeid - merge colors from 2 ids | rate - rates you on the subject you provide | 8ball - shakes an 8 ball | reverse - reverses text")
					} else if (args[1] == "other") {
						send("Commands: fave - favorites an item | faves - tells you favorited items | wipefaves - erases favorited items | mention - mentions a user | kick - kicks a user if holding crown | dm - starts a DM (direct message) to the specified user")
					} else if (args[1] != "userset" && args[1] != "info" && args[1] != "fun" && args[1] != "other") {
						send("Sorry, but that category doesn't exist. Valid categories: userset, info, fun, other - Do `help <category>` to access a category.")
					} /*else if (args[1] == "usage") { fix when you can, you dummy
                    if (args.length == 2) {
                        send("Please specify a command to know about. Example: help usage steal")
                    } else if (args[2] == "steal") {
                        send("Steal - This command takes the color from the ID or name you specify and sets your color to it. - Example: steal [ID or name]")
                    } else if (args[2] == "color") {
                        send("Color - This command sets your color to the hex code you specify, or tells the color of the specified ID or name. - Example 1: color #bababa - This example command sets your color to Baby Talk Grey. - This command can also get the color from a desired ID or name.")
                    } else if (args[2] == "name") {
                        send("Name - This command sets your name to the text you specify. - Example: name Anonymous is using colorsteal - This example command sets your name to \"Anonymous is using colorsteal\".")
                    } else if (args[2] == "shuffle") {
                        send("Shuffle - This command sets your color to a completely random color. - Example: shuffle - This example sets your color to a random color that you've probably never seen before.")
                    } else if (args[2] == "reset") {
                        send("Reset - This command resets your name and color to your default name and color, and can also reset your name or your color independently, by using \"reset name\" and \"reset color\" respectively. You can change your reset name and color by doing \"define reset name [name]\" and \"define reset color [hex code]\" respectively. - Example: reset")
                    } else if (args[2] == "mycolor") {
                        send("MyColor - This command tells you your current color in hex. - Example: mycolor - This example command tells you your current color.")
                    } else if (args[2] == "about") {
                        send("About - This command tells you bot info when no ID or name is provided, but if you specify an ID, it will tell you the info about that user. - Example 1: about ; This example sends a message with bot info. - Example 2: about [ID or name] ; This example sends a message with the info about the specified ID or name.")
                    } else if (args[2] == "help") {
                        send("Help - This command displays the list of commands in a category, or tells you the usage of a command. - Example 1: help info ; This example shows the commands in the \"info\" category. - Example 2: help usage steal ; This command shows the usage of the \"steal\" command.")
                    } else if (args[2] == "define") {
                        send("Define - This command defines a variable. - Example: define reset name Anonymous | This example command sets your reset name to Anonymous, so that when you use the \"reset\" command, your name is set to \"Anonymous\".")
                    } else if (args[2] == "whereami") {
                        send("WhereAmI - This command says your current room name. - Example: whereami - This example command says that \"You're in the room \"" + MPP.client.channel._id + "\".\"")
                    } else if (args[2] == "stat") {
                        send("Stat - This command adds a status at the end of your name. - Example: stat AFK - This example command sets your name to \"" + m.p.name + " [AFK]\".")
                    } else if (args[2] == "flip") {
                        send("Flip - This command has a 69% chance of saying \"*flips*\", and a 31% chance of saying \"*fails*\".")
                    } else if (args[2] == "fave") {
                        send("Fave - This command favorites an item. - Example: fave #bababa - baby gray - This example command favorites the string \"#bababa - baby gray\". You can check your favorited items with \"faves\".")
                    } else if (args[2] == "faves") {
                        send("Faves - This command tells you your favorited items.")
                    } else if (args[2] == "wipefaves") {
                        send("WipeFaves - This command erases all your favorited items permanently, with no way to bring them back.")
                    } else if (args[2] == "shitpost") {
                        send("Shitpost - This command sends a link to a random Sushi Monsters shitpost.")
                    } else if (args[2] == "ppl") {
                        send("PPL - This command sends a list of all IDs. You can get info about those IDs using \"about [ID]\".")
                    } else if (args[2] == "merge") {
                        send("Merge - This command merges 2 hex colors. - Example: merge #000000 ffffff. - This example command merges the colors black (000000) and white (#ffffff) which gives #808080 (gray)")
                    } else if (args[2] == "mergeid") {
                        send("MergeID - This command merges 2 colors from 2 IDs.")
                    } else if (args[2] == "playalone") {
                        send("PlayAlone - This command sends you to a Play Alone room.")
                    } else if (args[2] == "mention") {
                        send("Mention - This command mentions the user with the name/ID you provided.")
                    } else if (args[2] == "chown") {
                        send("ChOwn - This command sends the user ID of the person holding the crown.")
                    } else if (args[2] == "kick") {
                        send("Kick - This command kicks the user with the ID or name of the person you provide. If the user isn't found, you kick yourself instead.")
                    } else if (args[2] == "rate") {
                        send("Rate - This command tells you how associated you are with a certain topic.")
                    } else if (args[2] == "8ball") {
                        send("8 Ball - Shakes an 8 Ball to answer your question.")
                    } else if (args[2] == "checkversion") {
                        send("CheckVersion - Checks if there are any new updates.")
                    }
                }*/
				}
			} else {
				send('Help command is off. You can enable it using `define help on`.')
			}
		}
		/* cursed code
		if (cmd == 'get') {
			if (args.length == 1) {
				send('Please specify a category to get something from. Categories: random')
			} else if (args.length == 2) {
				if (args[1] == "random") {
					if (args.length == 2) {
						send('Please specify a thing to get from this category: Items: person, number')
					}
				}
			} else if (args[1] == "random")
				if (args[2] == "person") {
					send(MPP.client.ppl[Object.keys(MPP.client.ppl)[Math.floor(Math.random()*Object.keys(MPP.client.ppl).length)]].name)
				} else if (args[2] == "number") {
					send("Random number (0 to 100): " + Math.floor(Math.random()*100))
				}
			}
		}*/
		if (cmd == "stranger") {
			send(MPP.client.ppl[Object.keys(MPP.client.ppl)[Math.floor(Math.random() * Object.keys(MPP.client.ppl).length)]].name + " - " + MPP.client.ppl[Object.keys(MPP.client.ppl)[Math.floor(Math.random() * Object.keys(MPP.client.ppl).length)]].color)
		}
		if (cmd == "kick") {
			if ("crown" in MPP.client.channel) {
				if (MPP.client.channel.crown.userId == MPP.client.getOwnParticipant()._id) {
					if (args.length < 3) {
						send('You need to specify more arguments. Usage: `kick [id] [minutes] [reason]`')
					} else {
						let mem = MPP.client.channel._id;
						MPP.client.sendArray([{ "m": "kickban", "_id": findUser(args[1])._id, "ms": parseInt(args[2]) * 60000 }]);
						MPP.client.setChannel('test/awkward');
						if (args.length == 3) {
							send("You have been kicked from `" + mem + "` for " + args[2] + " minutes. Reason: `No reason provided`")
						} else if (args.length > 3) {
							send("You have been kicked from `" + mem + "` for " + args[2] + " minutes. Reason: `" + m.a.substring(args[0].length + args[1].length + args[2].length + 3).trim() + "`")
						}
						MPP.client.setChannel(mem);
					}
				} else {
					send(MPP.client.ppl[MPP.client.channel.crown.userId].name + " (" + MPP.client.channel.crown.userId + ') is the crown holder. You can try asking for them to kick the person or asking for the crown (if this room was yours).')
				}
			} else {
				send("You can't kick someone in a lobby room.")
			}
		}
		if (cmd == "dm") {
			if (args.length == 1) {
				send("Please specify an ID or name to DM.")
			} else {
				if (findUser(m.a.substring(2)._id.trim()) == undefined) {
					send("Sorry, but that ID/name wasn't found in the room. Maybe you've misspelled it.")
				} else {
					MPP.chat.startDM(findUser(m.a.substring(2).trim()))
					document.getElementById('chat-input').placeholder = "Direct messaging " + findUser(m.a.substring(2).trim()).name + " - Press enter 2 times to exit DM"
				}
			}
		}
		if (cmd == "chown") {
			if ("crown" in MPP.client.channel) {
				if (MPP.client.channel.crown.userId == MPP.client.getOwnParticipant()._id) {
					send("You are the crown holder.")
				} else {
					send(MPP.client.ppl[MPP.client.channel.crown.userId].name + " (`" + MPP.client.channel.crown.userId + '`) is the crown holder.')
				}
			} else {
				send("There is no crown holder.")
			}
		}
		if (cmd == "rate") {
			if (args.length == 1) {
				send("You are 100% sending an empty topic to this command.")
			} else {
				send(`You are ${Math.floor(Math.random() * 100)}% ${m.a.substring(4).trim()}.`)
			}
		}
		if (cmd == "merge") {
			if (args.length < 3) {
				send("Please specify 2 hex colors to merge. If you want to merge the colors of 2 IDs, use \"mergeid\". Usage: merge [hex 1] [hex 2] [mix amount*] *Optional")
			} else if (args[1].includes('#')) {
				if (args[2].includes('#')) {
					send(args[1] + " + " + args[2] + " = " + blendColors(args[1], args[2], 0.5))
				} else {
					send(args[1] + " + " + args[2] + " = " + blendColors(args[1], "#" + args[2], 0.5))
				}
			} else if (args[2].includes('#')) {
				send(args[1] + " + " + args[2] + " = " + blendColors("#" + args[1], args[2], 0.5))
			} else {
				send(args[1] + " + " + args[2] + " = " + blendColors('#' + args[1], "#" + args[2], 0.5))
			}
		}
		if (cmd == "ppl") {
			send(Object.values(MPP.client.ppl).length + ": " + getPpl().ids)
			send(Object.values(MPP.client.ppl).length + ": " + getPpl().names)
		}
		if (cmd == "mergeid") {
			if (args.length < 3) {
				send("Please specify 2 IDs to merge colors from. If you want to merge 2 hex colors, use \"merge\".")
			} else {
				send(findUser(args[1]).name + " (" + findUser(args[1]).color + ") + " + findUser(args[2]).name + " (" + findUser(args[2]).color + ") = " + blendColors(findUser(args[1]).color, findUser(args[2]).color, 0.5))
			}
		}
		if (cmd == 'shitpost') {
			send(shitpost)
		}
		if (cmd == "fave") {
			if (args.length == 1) {
				if (localStorage.fave == undefined) {
					localStorage.setItem("fave", " color: " + m.p.color + " - name: " + m.p.name)
					send('faved!')
				} else {
					localStorage.setItem("fave", localStorage.fave + ", color: " + m.p.color + " - name: " + m.p.name)
					send('faved!')
				}
			} else {
				if (localStorage.fave == undefined) {
					localStorage.setItem("fave", m.a.substring(4).trim())
					send("faved!")
				} else {
					localStorage.setItem("fave", localStorage.fave + ", " + m.a.substring(4).trim())
					send("faved!")
				}
			}
		}
		if (cmd == "faves") {
			if (localStorage.fave == undefined) {
				send("you have no faves! (maybe you wiped your faves..?)")
			} else {
				send(localStorage.fave)
			}
		}
		if (cmd == "wipefaves") {
			if (args.length == 1) {
				send("ARE YOU SURE? [y/n]")
			} else {
				if (args[1] == "y") {
					send("wiped!")
					localStorage.removeItem('fave')
				} else {
					if (args[1] == "n") { send("ok!") }
				}
			}
		}
		if (cmd == "stat") {
			if (m.a.substring(4).trim().length + m.p.name.length + 2 > 40) {
				send("stat too long!! (final name length: " + (m.a.substring(4).trim().length + m.p.name.length + 3) + " - maximum name length: 40)")
			} else {
				MPP.client.sendArray([{
					m: 'userset',
					set: {
						name: `${m.p.name} [${m.a.substring(4).trim()}]"`
					}
				}]);
				send("set!")
			}
		}
		/*
		if (cmd == "quotacheck") {
			let a = m.p.color
			MPP.client.sendArray([{
				m: 'userset',
				set: {
					color: randomhex
				}
			}]);
			if (MPP.client.ppl[MPP.client.getOwnParticipant()._id].color == randomhex) {
				send("your userset quota has been met, you'll have to wait through 12 minutes at maximum.")
			} else {
				send("your userset quota hasn't been met yet")
			}
			MPP.client.sendArray([{
				m: 'userset',
				set: {
					color: a
				}
			}]);
		}*/
		if (cmd == "flip") {
			if (Math.random() < (69 / 100)) {
				send("\*flips*")
			} else {
				send("\*fails*")
			}
		}
		if (cmd == "shuffle") {
			MPP.client.sendArray([{
				m: 'userset',
				set: {
					color: randomhex
				}
			}]);
			send("Shuffled color: " + randomhex + " - " + colorname(randomhex))
		}
		if (cmd == "8ball") {
			if (args.length == 1) {
				send(noargsball[Math.floor(Math.random() * noargsball.length)])
			} else {
				send(ball[Math.floor(Math.random() * ball.length)])
			}
		}
		if (cmd == "steal") {
			MPP.client.sendArray([{
				m: 'userset',
				set: {
					color: findUser(args[1]).color
				}
			}]);
			send('Stolen from ' + findUser(args[1]).name + " (" + findUser(args[1])._id.slice(0, 6) + ") successfully.")
		}
		if (cmd == "reset") {
			if (localStorage.resetname == undefined && localStorage.resetcolor == undefined) {
				send("It seems you don't have your reset information defined. Use `define reset name " + m.p.name + "` and `define reset color " + m.p.color + "` to define your reset information.")
			} else
				if (localStorage.resetname == undefined) {
					send("It seems you don't have your reset name defined. Use `define reset name " + m.p.name + "` to define your reset name.")
				} else
					if (localStorage.resetcolor == undefined) {
						send("It seems you don't have your reset color defined. Use `define reset color " + m.p.color + "` to define your reset color.")
					} else {
						if (args.length == 1) {
							MPP.client.sendArray([{
								m: 'userset',
								set: {
									name: localStorage.resetname,
									color: localStorage.resetcolor
								}
							}]);
							receive({
								"color": "#6dee49", // pastel green
								"_id": "colors",
								"name": "Reset - ꧁⌬♩♪♫ ⋰〈 🏳️‍⚧️ ᴄᴄᴊᴛ 🏳️‍⚧️ ⌨ 〉⋱ ♫♪♩⌬꧂",
								"id": "colorsteal"
							}, "Reset successfully.")
							receive({
								"color": localStorage.resetcolor,
								"name": localStorage.resetname,
								"_id": "colors",
								"id": "colorsteal"
							}, "< If this isn't your username and color, your userquota ran out. You can try resetting yourself after 12 minutes in that case.")
						} else if (args[1] == "color") {
							MPP.client.sendArray([{
								m: 'userset',
								set: {
									color: localStorage.resetcolor
								}
							}]);
							receive({
								"color": localStorage.resetcolor,
								"_id": "colors",
								"name": "Reset - ꧁⌬♩♪♫ ⋰〈 🏳️‍⚧️ ᴄᴄᴊᴛ 🏳️‍⚧️ ⌨ 〉⋱ ♫♪♩⌬꧂",
								"id": "colorsteal"
							}, "Reset your color successfully.")
							receive({
								"color": MPP.client.getOwnParticipant().color,
								"_id": "colors",
								"name": localStorage.resetname,
								"id": "colorsteal"
							}, "< If this isn't your color, your userquota ran out. You can try resetting yourself after 12 minutes in that case.")
						} else if (args[1] == "name") {
							MPP.client.sendArray([{
								m: 'userset',
								set: {
									name: localStorage.resetname
								}
							}]);
							receive({
								"color": "#6dee49", // pastel green
								"_id": "colors",
								"name": "Reset - ꧁⌬♩♪♫ ⋰〈 🏳️‍⚧️ ᴄᴄᴊᴛ 🏳️‍⚧️ ⌨ 〉⋱ ♫♪♩⌬꧂",
								"id": "colorsteal"
							}, "Reset your name successfully.")
							receive({
								"color": MPP.client.getOwnParticipant().color,
								"_id": "colors",
								"name": MPP.client.getOwnParticipant().name,
								"id": "colorsteal"
							}, "< If this isn't your username, your userquota ran out. You can try resetting yourself after 12 minutes in that case.")
						}
					}
		}
		if (cmd == "mycolor") {
			send("Your user color is " + m.p.color.toUpperCase() + " - *" + colorname(m.p.color) + "*")
		}
		if (cmd == "settings") {
			send(`Room settings - Room name: ${MPP.client.channel._id} - Limit: ${MPP.client.channel.settings.limit} - Inner color: ${MPP.client.channel.settings.color} - Outer color: ${MPP.client.channel.settings.color2} - Visible: ${MPP.client.channel.settings.visible} - Crown holder: ${MPP.client.channel.crown.userId}`)
		}
		if (cmd == "define") {
			if (args.length == 1) {
				send("Please insert a category to define. Categories: reset, help - or get a variable with \"get\"")
			} else {
				if (args[1] == "reset") {
					if (args.length == 2) {
						send("Please insert a variable to define. Variables: name, color - or reset to defaults with \"default\"")
					} else {
						if (args[2] == "name") {
							localStorage.setItem("resetname", m.a.substring(17).trim())
							send("Your reset name is now " + localStorage.resetname + ".")
						} else if (args[2] == "color") {
							if (args[3].length == 7) {
								localStorage.setItem("resetcolor", m.a.substring(18).trim())
								send("Your reset color is now " + localStorage.resetcolor + ".")
							} else if (args[3].length == 6) {
								localStorage.setItem("resetcolor", "#" + m.a.substring(18).trim())
								send("Your reset color is now " + localStorage.resetcolor + ".")
							} else {
								send("That is not a valid hex color. Please specify a 6 digit* hex color. (*`#` symbol is optional)")
							}
						} else if (args[2] == "default") {
							localStorage.setItem("resetname", 'Anonymous')
							send("Your reset name is now Anonymous.")
							localStorage.setItem("resetcolor", randomhex)
							send("Your reset color is now " + localStorage.resetcolor + ".")
						}
					}
				} else if (args[1] == "help") {
					if (args.length == 2) {
						send("Please insert a value to define to. Values: off, on")
					} else {
						if (args[2] == "off") {
							localStorage.setItem("help", false)
							send("Help command is off.")
						} else if (args[2] == "on") {
							localStorage.setItem("help", true)
							send("Help command is on.")
						}
					}
				} else if (args[1] == "public") {
					if (args.length == 2) {
						send("Please insert a value to define to. Values: true, false, toggle - `Note: This variable is reset to false everytime you refresh for security measures. There will be a way to bypass this soon.`")
					} else {
						if (args[2] == "false") {
							public = false
							send("Commands are now private.")
						} else if (args[2] == "true") {
							public = true
							send("Commands are now public.")
						} else if (args[2] == "toggle") {
							public = !public
							send(public ? "Commands are now public." : "Commands are now private.")
						}
					}
				} else if (args[1] == 'get') {
					if (args.length == 2) {
						send("Please insert a variable. Variables: resetname, resetcolor")
					} else if (args[2] == "resetname") {
						send("Your reset name is " + localStorage.resetname)
					} else if (args[2] == "resetcolor") {
						send('Your reset color is ' + localStorage.resetcolor)
					}
				}
			}
		}
		if (cmd == "mention") {
			if (args.length == 1) {
				send("Please specify the ID or name of the user to mention.")
			} else {
				send("@" + findUser(args[1])._id)
			}
		}
		if (cmd == "refresh") {
			send("Refreshing...")
			location.replace(location.href)
		}
		if (cmd == "about") {
			if (args.length == 1) {
				send(`${atob('Qm90IG1hZGUgdXNpbmcgcHVyZSBKYXZhU2NyaXB0IGFuZCBhIGxpdHRsZSBiaXQgb2YgY29kZSB0aGVmdA==')} - ${atob('eW91IGNhbiBmaW5kIHRoaXMgYm90IGF0')} ${atob('aHR0cHM6Ly9ncmVhc3lmb3JrLm9yZy9lbi9zY3JpcHRzLzUzMzE3MC1jb2xvcnN0ZWFs')} - ${atob('cmF3IHNvdXJjZSBjb2RlOiBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vY2NqaXQvY29sb3JzdGVhbC9yZWZzL2hlYWRzL21haW4vY29sb3JzdGVhbC5qcw==')} - ${atob('bWFkZSBieSBjY2p0IGluIDIwMjQtMjAyNQ==')} - Running version ${version}`)
			} else {
				if (args[1] == "me") {
					send("Your info - Name: " + MPP.client.ppl[MPP.client.getOwnParticipant()._id].name + " - Color: " + MPP.client.ppl[MPP.client.getOwnParticipant()._id].color + " - *" + colorname(MPP.client.ppl[MPP.client.getOwnParticipant()._id].color) + "* - ID: " + MPP.client.getOwnParticipant()._id + " - Mouse Position: X" + MPP.client.ppl[MPP.client.getOwnParticipant()._id].x + ", Y" + MPP.client.ppl[MPP.client.getOwnParticipant()._id].y + " - AFK: " + MPP.client.ppl[MPP.client.getOwnParticipant()._id].afk + " ||You can use \"steal " + args[1] + "\" to steal their color!||")
				} else {
					if (findUser(args[1]).name.substring(findUser(args[1]).name.length - 1, findUser(args[1]).name.length).trim() == "s") {
						if ('tag' in findUser(args[1])) {
							send(findUser(args[1]).name + "' info - Name: " + findUser(args[1]).name + " - Color: " + findUser(args[1]).color + " - *" + colorname(findUser(args[1]).color) + "* - ID: " + findUser(args[1])._id + " - Mouse Position: X" + findUser(args[1]).x + ", Y" + findUser(args[1]).y + " - AFK: " + findUser(args[1]).afk + " ||You can use \"steal " + args[1] + "\" to steal their color!||")
						} else {
							send(findUser(args[1]).name + "' info - Name: " + findUser(args[1]).name + " - Color: " + findUser(args[1]).color + " - *" + colorname(findUser(args[1]).color) + "* - ID: " + findUser(args[1])._id + " - Mouse Position: X" + findUser(args[1]).x + ", Y" + findUser(args[1]).y + " - AFK: " + findUser(args[1]).afk + " ||You can use \"steal " + args[1] + "\" to steal their color!||")
						}
					} else {
						if ('tag' in findUser(args[1])) {
							send(findUser(args[1]).name + "'s info - Name: " + findUser(args[1]).name + " - Color: " + findUser(args[1]).color + " - *" + colorname(findUser(args[1]).color) + "* - ID: " + findUser(args[1])._id + " - Mouse Position: X" + findUser(args[1]).x + ", Y" + findUser(args[1]).y + " - AFK: " + findUser(args[1]).afk + " - Tag: " + findUser(args[1]).tag.text + " - Tag color: " + findUser(args[1]).tag.color + "||You can use \"steal " + args[1] + "\" to steal their color!||")
						} else {
							send(findUser(args[1]).name + "'s info - Name: " + findUser(args[1]).name + " - Color: " + findUser(args[1]).color + " - *" + colorname(findUser(args[1]).color) + "* - ID: " + findUser(args[1])._id + " - Mouse Position: X" + findUser(args[1]).x + ", Y" + findUser(args[1]).y + " - AFK: " + findUser(args[1]).afk + " ||You can use \"steal " + args[1] + "\" to steal their color!||")
						}
					}
				}
			}
		}
		if (cmd == "playalone") {
			MPP.client.setChannel(randroom)
			window.history.replaceState(null, "", location.href.split('/?c=')[0] + "/?c=" + randroom)
			MPP.client.sendArray([{
				'm': "chset",
				"set": {
					"visible": false,
					"color": "#220022",
					"color2": "#000022"
				}
			}]);
			send("**Playing alone**")
			send("────────────────")
			send("You are playing alone in a room by yourself, but you can always invite friends by sending them the link. " + location.href)
		}
		if (cmd == "goto") {
			if (args.length == 1) {
				send("Please specify a room to go to.")
			} else {
				MPP.client.setChannel(m.a.substring(4).trim())
				window.history.replaceState(null, "", location.href.split('/?c=')[0] + "/?c=" + m.a.substring(4).trim())
			}
		}
		if (cmd == "whereami") {
			send("You're in the room \"" + MPP.client.channel._id + "\".")
		}
		if (cmd == "name") {
			MPP.client.sendArray([{
				m: 'userset',
				set: {
					name: m.a.substring(4).trim()
				}
			}]);
			send("​Name set to \"" + m.a.substring(4).trim() + "\".")
			localStorage.setItem('names', localStorage.names + "," + m.a.substring(4).trim())
		}
		if (cmd == "color") {
			if (args[1].length == 6) {
				MPP.client.sendArray([{
					m: 'userset',
					set: {
						color: "#" + args[1]
					}
				}]);
				send("​Color set to #" + args[1] + ". - *" + colorname("#" + args[1]) + "*")
			} else if (args[1].length == 7) {
				MPP.client.sendArray([{
					m: 'userset',
					set: {
						color: args[1]
					}
				}]);
				send("​Color set to " + args[1] + ". - *" + colorname(args[1]) + "*")
			} else if (args[1].length > 7) {
				send(findUser(args[1]).name + "'s color: " + findUser(args[1]).color + " - *" + colorname(findUser(args[1]).color) + "*")
			}
		}
	});
	setInterval(checkVersion(), 60000);
})();
