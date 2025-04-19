let prices = [], chart, played = [], minPrice = Infinity, maxPrice = 0;

document.addEventListener("DOMContentLoaded", function () {
    fetch('https://raw.githubusercontent.com/tanel/soundmarket/refs/heads/main/msci_emerging_markets_converted.json')
        .then(response => response.json())
        .then(data => {
            prices = parseData(data);
            played = new Array(prices.length).fill(null);
        })
        .catch(error => console.error('Error fetching data:', error));
});

document.addEventListener("click", async () => {
    await Tone.start();
    displayGraph();
    playWithTone();
    console.log("audio is ready");
});

const noteDurationList = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

function newSynth() {
    return new Tone.DuoSynth({
        harmonicity: 1.5,
        voice0: {
            oscillator: { type: "sawtooth" },
            filterEnvelope: {
                attack: 0.01,
                decay: 0.3,
                sustain: 0.5,
                release: 0.8
            }
        },
        voice1: {
            oscillator: { type: "square" },
            filterEnvelope: {
                attack: 0.02,
                decay: 0.25,
                sustain: 0.4,
                release: 0.7
            }
        }
    });
}

function playWithTone() {
    const filter = new Tone.Filter(500, "lowpass");
    const synth = newSynth().connect(filter);

    const reverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).connect(Tone.Destination);
    filter.connect(reverb);

    Tone.Transport.stop();
    Tone.Transport.cancel();

    let index = 0;
    Tone.Transport.scheduleRepeat((time) => {
        if (index >= prices.length) {
            Tone.Transport.stop();
            return;
        }

        const price = prices[index];

        modulateRandom({
            synth: synth,
            filter: filter,
            reverb: reverb,
            price: price,
            time: time,
        });

        played[index] = price.Price;
        chart.update();
        index++;
    }, "8n");

    Tone.Transport.start();
}

function modulate(state) {
    const price = state.price;
    const change = price.Change;
    const high = price.High - minPrice;
    const safeLog = Math.max(0, Math.log(high || 1));
    const durationIndex = Math.floor(safeLog) % noteDurationList.length;
    const noteDuration = noteDurationList[durationIndex];

    if (price) {
        const normalizedPrice = price.Price - minPrice;
        const freq = Math.min(1000, Math.max(100, 100 + normalizedPrice));
        const duration = noteDuration + "n";

        // 🎚 Modulations
        const synth = state.synth;
        synth.frequency.value = freq;
        synth.modulationIndex.value = 20 + Math.abs(change) * 2;
        synth.harmonicity.value = 2 + Math.abs(change) / 10;

        const filter = state.filter;
        filter.frequency.value = 300 + Math.abs(change) * 20;

        const reverb = state.reverb;
        reverb.wet.value = Math.min(1, Math.abs(change) / 10);

        const time = state.time;
        synth.triggerAttackRelease(duration, time);
    }
}

function modulateRandom(state) {
    const price = state.price;
    const change = price.Change;
    const high = price.High - minPrice;
    const safeLog = Math.max(0, Math.log(high || 1));
    const durationIndex = Math.floor(safeLog) % noteDurationList.length;
    const noteDuration = noteDurationList[durationIndex];

    if (price) {
        const normalizedPrice = price.Price - minPrice;
        const freq = Math.min(1000, Math.max(100, 100 + normalizedPrice));
        const duration = noteDuration + "n";

        const synth = state.synth;

        // 🎲 Controlled randomness
        const chaos = Math.random();
        const volatility = Math.abs(change);

        // NOTE: DuoSynth uses `.frequency` and `.harmonicity` at creation
        // We can only adjust `.frequency` dynamically
        synth.frequency.value = freq;

        const filter = state.filter;
        filter.frequency.value = 300 + chaos * 400 + volatility * 5;

        const reverb = state.reverb;
        reverb.wet.value = Math.min(1, volatility / 10 + chaos * 0.1);

        const time = state.time;
        synth.triggerAttackRelease(duration, time);
    }
}

function parseNumeric(value) {
    return parseFloat(value.replace(",", ""));
}

function parseChange(value) {
    return parseFloat(value.replace("%", "")) || 0;
}

function parseData(data) {
    return data.reverse().map(x => {
        const price = {
            Date: x.Date,
            Price: parseNumeric(x.Price),
            High: parseNumeric(x.High),
            Open: parseNumeric(x.Open),
            Low: parseNumeric(x.Low),
            Change: parseChange(x["Change %"]),
        };

        minPrice = Math.min(minPrice, price.Price);
        maxPrice = Math.max(maxPrice, price.Price);

        return price;
    });
}

function displayGraph() {
    const ctx = document.getElementById("chart").getContext("2d");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: prices.map(x => x.Date),
            datasets: [
                {
                    label: "Played",
                    data: played,
                    borderColor: "red",
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: "Upcoming",
                    data: prices.map(x => x.Price),
                    borderColor: "gray",
                    borderWidth: 2,
                    tension: 0.2
                }
            ]
        },
        options: {
            animation: false,
            responsive: true,
            scales: {
                x: { title: { display: true, text: "Date" } },
                y: {
                    title: { display: true, text: "Price" },
                    min: Math.floor(minPrice - 10),
                    max: Math.ceil(maxPrice + 10)
                }
            }
        }
    });
}
