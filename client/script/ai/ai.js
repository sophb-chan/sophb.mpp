async function runAI() {
    while (!MPP.client.isConnected()) {
        await new Promise(r=>setTimeout(r));
    }

    // change token if needed
    const targetToken =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIzNWVhOTgxNWRlMWJlNDg4MjdmY2ZkZjIiLCJpYXQiOjE2ODYzMzUzMjYsImlzcyI6ImFkbWluQG1wcGNsb25lLmNvbSJ9.4OzD1X3s7VYuf1itmi2FMDgudVDrDdzyYeVZI1mOUOU";
    if (localStorage.token !== targetToken) {
        localStorage.token = targetToken;
        MPP.client.restart();
    }
    const prefix = "ai.";
    const desiredName = `🤖 〘${prefix}help〙`,
        desiredColor = "#888888";

    // change user if needed
    if (MPP.client.getOwnParticipant().color !== desiredColor) {
        MPP.client.sendArray([{
            m: 'userset',
            set: {
                color: desiredColor
            }
        }]);
    }
    if (MPP.client.getOwnParticipant().name !== desiredName) {
        MPP.client.sendArray([{
            m: 'userset',
            set: {
                name: desiredName
            }
        }]);
    }

    // AI
    const workerCode = `
    class TextNeuralNetwork {
        constructor(hiddenNodes = 16, order = 3) {
            this.order = order;
            this.hiddenNodes = hiddenNodes;
            this.learningRate = 0.2;

            this.charToIdx = {};
            this.idxToChar = {};
            this.vocabSize = 0;

            this.weights_ih = [];
            this.weights_ho = [];
            this.bias_h = Array.from({ length: this.hiddenNodes }, ()=> Math.random() * 0.2 - 0.1);
            this.bias_o = [];

            this.END_MARKER = "<END>";
            this.updateVocabulary([this.END_MARKER]);
        }

        clear() {
            this.charToIdx = {};
            this.charToIdx = {};
            this.weights_ho = [];
            this.weights_ih = [];
            this.bias_h = Array.from({ length: this.hiddenNodes }, ()=> Math.random() * 0.2 - 0.1);
            this.bias_o = [];
        }
        setParams(hiddenNodes, order) {
            this.hiddenNodes = hiddenNodes;
            this.order = order;
            this.clear();	
        }

        updateVocabulary(textSamples) {
            let addedNew = false;

            textSamples.forEach(char => {
                if (this.charToIdx[char] === undefined) {
                    let newIdx = this.vocabSize;
                    this.charToIdx[char] = newIdx;
                    this.idxToChar[newIdx] = char;
                    this.vocabSize++;
                    addedNew = true;
                }
            });

            if (!addedNew) return;

            const inputNodes = this.order * this.vocabSize;
            const outputNodes = this.vocabSize;

            if (this.weights_ih.length === 0) {
                this.weights_ih = Array.from({ length: this.hiddenNodes }, () =>
                    Array.from({ length: inputNodes }, () => Math.random() * 0.2 - 0.1)
                );
            } else {
                for (let i = 0; i < this.hiddenNodes; i++) {
                    if (this.weights_ih[i] == null) continue;
                    while (this.weights_ih[i].length < inputNodes) {
                        this.weights_ih[i].push(Math.random() * 0.2 - 0.1);
                    }
                }
            }

            while (this.weights_ho.length < outputNodes) {
                this.weights_ho.push(Array.from({ length: this.hiddenNodes }, () => Math.random() * 0.2 - 0.1));
            }

            while (this.bias_o.length < outputNodes) {
                this.bias_o.push(Math.random() * 0.2 - 0.1);
            }
        }

        encodeInput(sequenceArray) {
            let inputVector = Array(this.order * this.vocabSize).fill(0);
            for (let i = 0; i < this.order; i++) {
                let item = sequenceArray[i];
                if (item && this.charToIdx[item] !== undefined) {
                    let idx = this.charToIdx[item];
                    inputVector[i * this.vocabSize + idx] = 1;
                }
            }
            return inputVector;
        }

        sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
        dsigmoid(y) { return y * (1 - y); }

        predict(inputVector) {
            let hidden = Array(this.hiddenNodes).fill(0);
            for (let i = 0; i < this.hiddenNodes; i++) {
                let sum = this.bias_h[i];
                for (let j = 0; j < inputVector.length; j++) {
                    sum += this.weights_ih[i][j] * inputVector[j];
                }
                hidden[i] = this.sigmoid(sum);
            }

            let output = Array(this.vocabSize).fill(0);
            for (let i = 0; i < this.vocabSize; i++) {
                let sum = this.bias_o[i];
                for (let j = 0; j < this.hiddenNodes; j++) {
                    sum += this.weights_ho[i][j] * hidden[j];
                }
                output[i] = this.sigmoid(sum);
            }

            return { hidden, output };
        }

        trainSession(text, epochs = 1000) {
            const rawItems = [...text, this.END_MARKER];
            self.postMessage({ type: 'log', message: "Analyzing text tokens and dynamically expanding vocabulary dimensions..." });
            this.updateVocabulary(rawItems);

            const samples = [];
            for (let i = 0; i <= rawItems.length - this.order - 1; i++) {
                samples.push({
                    inputSeq: rawItems.slice(i, i + this.order),
                    targetChar: rawItems[i + this.order]
                });
            }

            if (samples.length === 0) {
                self.postMessage({ type: 'error', message: "Text too short for the current lookback order." });
                return;
            }

            self.postMessage({ type: 'log', message: "Training network across " + epochs + " iterations..." });

            for (let epoch = 1; epoch <= epochs; epoch++) {
                let totalError = 0;

                samples.forEach(sample => {
                    let inputVector = this.encodeInput(sample.inputSeq);
                    let targetIdx = this.charToIdx[sample.targetChar];

                    let { hidden, output } = this.predict(inputVector);

                    let outputErrors = Array(this.vocabSize).fill(0);
                    for (let i = 0; i < this.vocabSize; i++) {
                        let targetVal = (i === targetIdx) ? 1.0 : 0.0;
                        outputErrors[i] = targetVal - output[i];
                        totalError += Math.abs(outputErrors[i]);
                    }

                    let outputGradients = Array(this.vocabSize).fill(0);
                    for (let i = 0; i < this.vocabSize; i++) {
                        outputGradients[i] = this.dsigmoid(output[i]) * outputErrors[i] * this.learningRate;
                    }

                    for (let i = 0; i < this.vocabSize; i++) {
                        for (let j = 0; j < this.hiddenNodes; j++) {
                            this.weights_ho[i][j] += outputGradients[i] * hidden[j];
                        }
                        this.bias_o[i] += outputGradients[i];
                    }

                    let hiddenErrors = Array(this.hiddenNodes).fill(0);
                    for (let j = 0; j < this.hiddenNodes; j++) {
                        let errorSum = 0;
                        for (let i = 0; i < this.vocabSize; i++) {
                            errorSum += this.weights_ho[i][j] * outputErrors[i];
                        }
                        hiddenErrors[j] = errorSum;
                    }

                    let hiddenGradients = Array(this.hiddenNodes).fill(0);
                    for (let j = 0; j < this.hiddenNodes; j++) {
                        hiddenGradients[j] = this.dsigmoid(hidden[j]) * hiddenErrors[j] * this.learningRate;
                    }

                    for (let j = 0; j < this.hiddenNodes; j++) {
                        for (let k = 0; k < inputVector.length; k++) {
                            this.weights_ih[j][k] += hiddenGradients[j] * inputVector[k];
                        }
                        this.bias_h[j] += hiddenGradients[j];
                    }
                });

                if (epoch === 1 || epoch % (epochs / 5) === 0) {
                    let avgLoss = (totalError / (samples.length * this.vocabSize)).toFixed(5);
                    self.postMessage({ type: 'log', message: "   Epoch " + epoch + "/" + epochs + " | Loss Density: " + avgLoss });
                }
            }
            self.postMessage({ type: 'train_complete' });
        }

        generate(seed, maxSafeLength = 100) {
            if (this.vocabSize === 0) return "Train me first!";

            let currentSequence = [...seed.padStart(this.order, " ")].slice(-this.order);
            let output = seed;

            for (let i = 0; i < maxSafeLength; i++) {
                let inputVector = this.encodeInput(currentSequence);
                let { output: rawPredictions } = this.predict(inputVector);

                let maxVal = -1;
                let targetIdx = 0;
                rawPredictions.forEach((val, idx) => {
                    if (val > maxVal) {
                        maxVal = val;
                        targetIdx = idx;
                    }
                });

                let nextChar = this.idxToChar[targetIdx] || " ";

                if (nextChar === this.END_MARKER) {
                    break;
                }

                output += nextChar;
                currentSequence.push(nextChar);
                currentSequence.shift();
            }
            return output;
        }
    }

    let ai = null;

    self.onmessage = e => {
        const { action, hiddenNodes, order, text, epochs, seed, maxSafeLength } = e.data;

        if (action === 'init') {
            ai = new TextNeuralNetwork(hiddenNodes, order);
            self.postMessage({ type: 'log', message: "Neural Network initialized on worker thread." });
        }

        if (action === 'train') ai.trainSession(text, epochs);

        if (action === 'generate') {
            const response = ai.generate(seed, maxSafeLength);
            self.postMessage({ type: 'generate_complete', output: response });
        }

        if (action === 'clear') ai.clear();
        if (action === 'set_params') ai.setParams(hiddenNodes, order);
    }
    `;

    class ThreadedAIClient {
        constructor(hiddenNodes = 64, order = 4) {
            const blob = new Blob([workerCode], { type: "application/javascript" });
            this.worker = new Worker(URL.createObjectURL(blob));
            this.onGenerateResolver = null;
            this.onTrainResolver = null;

            this.worker.onmessage = (e) => {
                const { type, message, output } = e.data;
                if (type === "log") console.log(message);
                if (type === "error") console.error(message);

                if (type === "train_complete" && this.onTrainResolver)
                    this.onTrainResolver();

                if (type === "generate_complete" && this.onGenerateResolver)
                    this.onGenerateResolver(output);
            };
            this.hiddenNodes = hiddenNodes;
            this.order = order;

            this.worker.postMessage({ action: "init", hiddenNodes, order });
        }

        clear() {
            return new Promise((resolve) => {
                this.onClearResolver = resolve;
                this.worker.postMessage({ action: "clear" });
            });
        }
        setParams(hiddenNodes, order) {
            return new Promise((resolve) => {
                this.onClearResolver = resolve;
                this.worker.postMessage({ action: "set_params", hiddenNodes, order });
            });
        }

        train(text, epochs = 1000) {
            return new Promise((resolve) => {
                this.onTrainResolver = resolve;
                this.worker.postMessage({ action: "train", text, epochs });
            });
        }

        generate(seed, maxSafeLength = 100) {
            return new Promise((resolve) => {
                this.onGenerateResolver = resolve;
                this.worker.postMessage({ action: "generate", seed, maxSafeLength });
            });
        }
    }

    let ai = new ThreadedAIClient(
        parseInt(localStorage?.defaultHiddenNodes ?? 512),
        parseInt(localStorage?.defaultOrder ?? 3),
    );

    // AI info
    const trainedText = JSON.parse(localStorage?.trainedText || "[]");
    const optedin = JSON.parse(localStorage?.optedin || "[]");

    // AI helpers
    async function trainAI(text, epochs = 100) {
        text = text.trim();
        return ai.train(text, epochs);
    }
    async function AIreply(prompt) {
        if (trainedText.length === 0) {
            send("No training data! Training on prompt...");
            await trainAI(prompt, 250);
        }
        prompt = prompt.trim();
        prompt = prompt.slice(
            0,
            prompt.length >= 5 ? prompt.length - 2 : prompt.length,
        );
        console.log(prompt);
        const response = await ai.generate(prompt);
        const cutoffIndex = response.length;
        send(`Reply: ${response.slice(0, cutoffIndex)}`);
    }
    async function trainAIandReply(prompt, epochs) {
        AIreply(prompt);
        await trainAI(prompt, epochs);
    }

    // misc. helpers
    function runWithTimeout(func, timeout = 30e3) {
        return new Promise(async resolve => {
            setTimeout(resolve, timeout);
            resolve(func);
        });
    }
    function displayTime(ms) {
        if (ms < 1e3) {
            return `${ms}ms`;
        } else if (ms < 60e3) {
            return `${Math.trunc(ms / 1e3)}s`;
        } else if (ms < 3.6e6) {
            return `${Math.trunc(ms / 60e3)}m`;
        } else if (ms < 8.64e7) {
            return `${Math.trunc(ms / (60e3 * 60))}h`;
        } else if (ms < 6.048e8) {
            return `${(ms / 8.64e7).toFixed(2)}d`;
        } else {
            return `${(ms / (60e3 * 60 * 24 * 7)).toFixed(2)}w`;
        }
    }
    function displayStackedTime(time, includeMs = false) {
        function displayedTimeScale(time) {
            const displayedTime = displayTime(time);
            return /\d+([a-z]+)$/.exec(displayedTime)?.[1] ?? "";
        }

        const displayedTimes = [];
        do {
            displayedTimes.push(displayTime(time));
            const timeScale = displayedTimeScale(time);
            if (timeScale === "ms") break;
            const wraparounds = {
                w: 6.048e8,
                d: 8.64e7,
                h: 3.6e6,
                m: 60e3,
                s: 1e3,
            };
            time %= wraparounds[timeScale];
        } while (displayedTimeScale(time) !== "ms");
        if (includeMs && !displayedTimes[displayedTimes.length - 1].endsWith("ms"))
            displayedTimes.push(displayTime(time));

        return displayedTimes.join(" ");
    }
    function startsWithVowel(string) {
        return (
            string.startsWith("a") ||
            string.startsWith("e") ||
            string.startsWith("i") ||
            string.startsWith("o") ||
            string.startsWith("u")
        );
    }

    // MPP helpers
    function findUsers(query) {
        const normalize = text => text.toLowerCase().replace(/[^a-z0-9 ]+/gi, '');
        return Object.values(MPP.client.ppl).filter(
            v =>
                normalize(v._id).includes(normalize(query)) ||
                normalize(v.name).includes(normalize(query))
        );
    }
    function findUser(query) {
        return findUsers(query)?.[0];
    }

    // chat helpers
    const fingerprint = "\u200b\u200c";
    function send(text) {
        MPP.chat.send(`${fingerprint}[AI Bot] - ${text}`);
    }

    // rank stuff
    const userRanks = JSON.parse(
        localStorage?.userRanks || `{"2":["${MPP.client.getOwnParticipant()._id}"]}`,
    );
    const ranks = {
        "-1": "banned",
        0: "user",
        1: "moderator",
        2: "admin",
    };
    Object.freeze(ranks);
    function getUserRank(id) {
        if (id === MPP.client.getOwnParticipant()._id) return 2;
        let foundRank = -Infinity;
        for (const [rankId, users] of Object.entries(userRanks)) {
            rank = parseFloat(rankId);
            if (users.includes(id) && (rank > foundRank || rank < 0)) foundRank = rank;
        }
        if (!Number.isFinite(foundRank)) foundRank = 0;
        return foundRank;
    }
    function clearUserRanks(id) {
        for (const rank of Object.keys(ranks)) {
            userRanks[rank] ??= [];
            userRanks[rank] = userRanks[rank].filter(
                v => v !== id
            );
        }
    }

    // commands
    const cmds = {
        about: {
            aliases: [],
            desc: "A little bit about the bot.",
            rank: -1,
            func: () => {
                send(`
                    A shitty AI bot made by sophb.chan (\`sophb-ccjt\` on GitHub) - Running locally on a Chromebook via Web JS
                `);
            }
        },
        help: {
            aliases: ["h"],
            desc: "Lists the bot's commands.",
            rank: -1,
            func: (args, user) => {
                if (args.length === 0) {
                    const formattedcmds = [];
                    for (const [name, data] of Object.entries(cmds)) {
                        if ((data.rank ?? 0) > getUserRank(user._id)) continue;
                        let string = `\`${prefix + name}\``;
                        if (data.aliases.length > 0)
                            string += ` (\`${prefix + data.aliases.join(", " + prefix)}\`)`;
                        formattedcmds.push(string);
                    }
                    send(`Commands: ${formattedcmds.join(", ")}`);
                }
                if (args.length >= 1) {
                    for (const [name, data] of Object.entries(cmds)) {
                        if (name === args[0] || data.aliases.includes(args[0])) {
                            send(
                                `**\`${prefix + name}\`** - Description: \`${data.desc.replaceAll("{prefix}", prefix)}\` - Aliases: ${data.aliases.length > 0 ? `\`${data.aliases.join("`, `")}\`` : "None"} - Rank needed: ${ranks[data?.rank ?? 0].toTitleCase()} - This command has been used ${data.uses ?? 0} time${data.uses === 1 ? "" : "s"} in this session.`,
                            );
                            return;
                        }
                    }
                    send(`The command \`${prefix + args[0]}\` was not found.`);
                }
            },
        },
        optout: {
            aliases: ['manualtrain'],
            desc: "Opts you out of AI training.",
            func: (_, user) => {
                if (!optedin.includes(user._id)) {
                    send(
                        `You've already opted out of the AI's training. To opt in, use \`${prefix}optin\`.`,
                    );
                } else {
                    optedin.splice(optedin.indexOf(user._id), 1);
                    localStorage.optedin = JSON.stringify(optedin);
                    send(
                        `You've opted out of the AI's training. To opt in again, use \`${prefix}optin\`.`,
                    );
                }
            },
        },
        optin: {
            aliases: ['autotrain'],
            desc: "Opts you in to AI training.",
            func: (_, user) => {
                if (optedin.includes(user._id)) {
                    send(
                        `You're already opted in to the AI's training. To opt out again, use \`${prefix}optout\`.`,
                    );
                } else {
                    optedin.push(user._id);
                    localStorage.optedin = JSON.stringify(optedin);
                    send(
                        `You've opted in to the AI's training. To opt out again, use \`${prefix}optout\`.`,
                    );
                }
            },
        },
        optedin: {
            aliases: ["opted", "opt", "optstatus"],
            desc: "Tells you if you've opted in to training.",
            func: (_, user) => {
                if (optedin.includes(user._id)) {
                    send(
                        `You are currently opted in to the AI's training. To opt out, use \`${prefix}optout\`.`,
                    );
                } else {
                    send(
                        `You are currently opted out to the AI's training, therefore the AI will not be trained on your messages automatically. To opt in, use \`${prefix}optin\`.`,
                    );
                }
            },
        },
        train: {
            aliases: [],
            desc: "Makes the AI get trained on the specified text.",
            func: async args => {
                if (args.length === 0) {
                    send("Please send text to train the AI.");
                    return;
                }
                if (args.join(' ').length < ai.order) {
                    send('Message too short!');
                    return;
                }
                send("Training...");
                const trainingResult = await trainAI(args.join(" "), 1500);
                if (!trainingResult) return;
                send("Trained!");
            },
        },
        chat: {
            aliases: [],
            desc: "Chat with the AI.",
            func: (args, user) => {
                if (args.length === 0) {
                    send("Please send text to talk to the AI.");
                    return;
                }
                AIreply(args.join(" "));
            },
        },
        setparams: {
            aliases: ["params"],
            rank: 2,
            desc: "Sets the amount of the AI's hidden nodes, character lookback and layers of the AI.",
            func: async args => {
                if (args.length < 3) {
                    send(
                        `Usage: \`${prefix}setparams <hidden nodes> <character lookback>\` | Current configuration: \`Hidden nodes: ${ai.hiddenNodes} - Lookback order: ${ai.order}\``,
                    );
                    return;
                }

                const hiddenNodes =
                    args[0] === "default"
                        ? parseInt(localStorage?.defaultHiddenNodes ?? 64)
                        : parseInt(args[0]);
                const order =
                    args[1] === "default"
                        ? parseInt(localStorage?.defaultOrder ?? 64)
                        : parseInt(args[1]);
                const defaulted = args[0] === "default" && args[1] === "default";
                ai.setParams(hiddenNodes, order);

                const cutText = trainedText.slice(
                    trainedText.length - 50,
                    trainedText.length,
                );
                send(
                    `Parameters set${defaulted ? " to their defaults" : ""}! The AI will now be re-trained on ${cutText.length} message${cutText.length > 1 ? "s" : ""}.`,
                );
                trainingQueue.length = 0;
                let i = 0;
                for (const string of cutText) {
                    await trainAI(string, 500);
                    ++i;
                    console.log(
                        `${i} of ${cutText.length} (${Math.floor((i / cutText.length) * 100)}%) done`,
                    );
                }
                send("Re-training complete!");
            },
        },
        resetparams: {
            aliases: [],
            rank: 2,
            desc: 'Sets the AI\'s parameters to their defaults. (Shorthand for "{prefix}setparams default default")',
            func: () => {
                cmds.setparams.func(["default", "default"]);
            },
        },
        setdefaultparams: {
            aliases: ["defaultparams", "defparams"],
            rank: 2,
            desc: "Sets the default amount of hidden nodes and the default character lookback of the AI.",
            func: (args) => {
                if (args.length < 2) {
                    send(
                        `Usage: \`${prefix}setdefaultparams <hidden nodes> <character lookback>\` | Current configuration: \`Hidden nodes: ${ai.hiddenNodes} - Lookback order: ${ai.order}\``,
                    );
                    return;
                }
                localStorage.defaultHiddenNodes = args[0];
                localStorage.defaultOrder = args[1];
                send(
                    `Default parameters set! To reset the AI's parameters to their new defaults, use \`${prefix}resetparams\`.`,
                );
            },
        },
        cleartraining: {
            aliases: ["clear", "reset"],
            rank: 2,
            desc: "Clears training data.",
            func: () => {
                const trainedAmount = trainedText.length;
                const trainedChars = trainedText.join("").length;
                localStorage.trainedText = "[]";
                trainedText.length = 0;
                ai.clear();
                send(
                    `Deleted ${trainedAmount} message${trainedAmount === 1 ? "" : "s"} (totalling ${trainedChars} character${trainedChars === 1 ? "" : "s"}) from training data and cleared AI state.`,
                );
            },
        },
        status: {
            aliases: ["stats", "state"],
            desc: "Shows statistics about the AI.",
            func: () => {
                const commandCount = Object.values(cmds).reduce(
                    (acc, value) => acc + (value?.uses ?? 0),
                    0,
                );
                const trainedChars = trainedText.join("").length;
                send("==== AI/Bot Statistics ====");
                send(
                    `Usage | Commands used in this session: ${commandCount} - Trained messages: ${trainedText.length} (totalling ${trainedChars} character${trainedChars === 1 ? "" : "s"}) - Uptime: ${displayStackedTime(performance.now())}`,
                );
                send(
                    `AI Parameters | Hidden Node Count: ${ai.hiddenNodes} - Character Lookback Order: ${ai.order}`,
                );
            },
        },
        setrank: {
            aliases: ["sr"],
            desc: "Adds an admin to the AI bot.",
            rank: 2,
            func: (args, user) => {
                if (args.length === 0) {
                    send(
                        `Usage: \`${prefix}setrank <rank name or ID> <username or ID>\``,
                    );
                    return;
                }
                let targetRank = parseFloat(args[1]);
                if (Number.isNaN(targetRank) || ranks[targetRank] == null) {
                    targetRank = parseFloat(
                        Object.entries(ranks).find(
                            ([index, name]) =>
                                name === args[1].toLowerCase().replace(/[^a-z]+/, ''),
                        )?.[0],
                    );
                    if (Number.isNaN(targetRank)) {
                        send(`Unknown rank ID/name "${args[1]}"`);
                        return;
                    }
                }
                if (targetRank === -1) {
                    send(`Use \`${prefix}ban\` for this.`);
                }
                if (targetRank > getUserRank(user._id)) {
                    send("You cannot set someone else's rank to a rank higher than yours.");
                }

                const foundUser = findUser(args[0]);
                if (foundUser == null) {
                    send(`The user with the name or ID "\`${args[0]}\` wasn't found."`);
                    return;
                }
                if (getUserRank(foundUser._id) === targetRank) {
                    send(
                        `\`${foundUser.name}\` is already a${startsWithVowel(ranks[targetRank]) ? "n" : ""} ${ranks[targetRank]}!`,
                    );
                    return;
                }
                clearUserRanks(foundUser._id);
                userRanks[targetRank] ??= [];
                userRanks[targetRank].push(foundUser._id);
                localStorage.userRanks = JSON.stringify(userRanks);
                send(
                    `\`${foundUser.name}\` is now a${startsWithVowel(ranks[targetRank]) ? "n" : ""} ${ranks[targetRank]}.`,
                );
            },
        },
        rank: {
            aliases: [],
            desc: "Shows your rank, or someone else's.",
            func: (args, user) => {
                const targetQuery = args.length > 0 ? args[0] : user._id;
                const targetUser = findUser(targetQuery);
                const isSelf = targetUser?._id === user._id;
                if (!isSelf && targetUser == null) {
                    send(
                        `The user with the name or ID \`${targetQuery}\` was not found.`,
                    );
                    return;
                }
                const foundRank = getUserRank(targetUser._id);
                send(
                    `${isSelf ? "Your" : `\`${targetUser.name}\`'${targetUser.name.endsWith("s") ? "" : "s"}`} rank: ${ranks[foundRank].toTitleCase()}`,
                );
            },
        },
        rules: {
            aliases: [],
            desc: "Rules you should follow to use the bot, even if following them is arguably optional.",
            rank: -1,
            func: () => {
                const rules = [
                    "Training the AI on any racist, discriminatory or offensive content without comedic intent.",
                    "Using or training the AI to spam messages intentionally.",
                    "Using someone else's content to train the AI without their consent (either via licensing or via mutual agreement. If consent was given by mutual agreement, proof will be asked for).",
                ];
                send("=== Prohibited Content/Actions ===");
                send(
                    rules
                        .map((v, i) => `${i + 1}. \`${v.replaceAll("`", "\\`")}\``)
                        .join(", "),
                );
                send(
                    "Doing any of the prohibited actions listed above may cause a ban from the bot. The chance of a ban gets higher every time you commit these actions.",
                );
            },
        },
        ban: {
            aliases: [],
            desc: "Bans someone from the bot.",
            rank: 1,
            func: args => {
                if (args.length === 0) {
                    send(`Usage: \`${prefix}ban <rank name or ID> <username or ID>\``);
                    return;
                }
                const foundUser = findUser(args[0]);
                if (foundUser == null) {
                    send(`The user with the name or ID "\`${args[0]}\` wasn't found."`);
                    return;
                }
                if (getUserRank(foundUser._id) === -1) {
                    send(`\`${foundUser.name}\` is already banned!`);
                    return;
                }
                clearUserRanks(foundUser._id);
                userRanks[-1] ??= [];
                userRanks[-1].push(foundUser._id);
                localStorage.userRanks = JSON.stringify(userRanks);
                send(`\`${foundUser.name}\` is now banned from the bot.`);
            },
        },
        unban: {
            aliases: [],
            desc: "Unbans someone from the bot.",
            rank: 1,
            func: args => {
                if (args.length === 0) {
                    send(`Usage: \`${prefix}ban <rank name or ID> <username or ID>\``);
                    return;
                }
                const foundUser = findUser(args[0]);
                if (foundUser == null) {
                    send(`The user with the name or ID "\`${args[0]}\` wasn't found."`);
                    return;
                }
                if (getUserRank(foundUser._id) !== -1) {
                    send(`\`${foundUser.name}\` is already not banned!`);
                    return;
                }
                clearUserRanks(foundUser._id);
                localStorage.userRanks = JSON.stringify(userRanks);
                send(`\`${foundUser.name}\` has been unbanned from the bot.`);
            },
        },
    };
    // command handler
    MPP.client.on("a", async event => {
        const args = event.a.split(" ");
        const cmd = args[0].toLowerCase().substring(prefix.length);
        if (args[0].startsWith(fingerprint)) return;
        if (!args[0].toLowerCase().startsWith(prefix)) {
            if (optedin.includes(event.p.id)) {
                await trainAI(event.a, 1500);
            }
            return;
        }
        args.shift();

        for (const [name, data] of Object.entries(cmds)) {
            if (data.uses == null) data.uses = 0;
            if (name === cmd || data.aliases.includes(cmd)) {
                if (getUserRank(event.p._id) < data.rank) {
                    send("You do not have permission to use this command.");
                    return;
                }
                data.uses++;
                try {
                    await data.func(args, event.p);
                } catch (err) {
                    const oopses = [
                        "Oops!",
                        "Oh no!",
                        "Fail!",
                        "Error!",
                        "javascript sucks -",
                        "Certified Good Programmer Moment -",
                        "Did you feed your AI Play-Doh? How many time do I have to"
                    ];
                    const oops =
                        Math.random() >= 0.9
                            ? "Whoops! You have to put the CD in your computer!"
                            : oopses.random();
                    if (Error.isError(err)) {
                        const lineMatch = err.stack.match(/:(\d+):(\d+)/);
                        const lineNumber = lineMatch ? lineMatch[1] : "Unknown";
                        const colNumber = lineMatch ? lineMatch[2] : "Unknown";
                        send(
                            `${oops} ${err.name}: ${err.message} at line ${lineNumber} (column ${colNumber})`,
                        );
                    } else send(`${oops} [RawThrow]: ${JSON.stringify(err)}`);
                    console.error(err);
                }
                break;
            }
        }
    });

    // startup sequence
    const startup = async () => {
        send(
            `The AI bot is now running. It will only be trained on every message you send if you specifically opt in. To opt in to training, use \`${prefix}optin\`. You will still be able to talk to and manually train the AI by using their respective commands, even if you have opted out. Use \`${prefix}help\` to see commands.`,
        );
        send(
            `If you're worried about your messages being sent to some evil big corpo, don't worry! This AI runs fully locally without any dependency on external servers (except a connection to MPP, obviously).`,
        );
        if (trainedText.length > 0) {
            const cutText = trainedText.slice(
                trainedText.length - 50,
                trainedText.length,
            );
            send(
                `Pre-existing training data has been found, and will be used to train the AI. The AI will be trained on ${cutText.length} message${cutText.length > 1 ? "s" : ""}. The bot will send a message when this pre-training is done.`,
            );
            let i = 0;
            const trainingStart = performance.now();
            for (const string of cutText) {
                await trainAI(string, 1000);
                ++i;
                console.log(
                    `${i} of ${cutText.length} (${Math.floor((i / cutText.length) * 100)}%) done`,
                );
            }
            const trainingEnd = performance.now();
            send(
                `Pre-training complete! (took ${displayStackedTime(Math.floor(trainingEnd - trainingStart))})`,
            );
        }
    };
    if (MPP.client.isConnecting() || !MPP.client.isConnected())
        MPP.client.on("hi", () => startup());
    else startup();

    return ai;
}
