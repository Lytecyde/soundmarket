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
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const filter = new Tone.Filter(500, "lowpass");
    const synth = newSynth().connect(filter);
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).connect(Tone.Destination);
    filter.connect(reverb);

    const events = prices.map((price, index) => {
        const stepTime = `${index * 0.5}`;
        return [stepTime, { index, price }];
    });

    const part = new Tone.Part((time, event) => {
        modulateRandom({
            synth,
            filter,
            reverb,
            price: event.price,
            time: time,
        });

        played[event.index] = event.price.Price;
        chart.update();
    }, events);

    part.start(0);
    Tone.Transport.start();
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
