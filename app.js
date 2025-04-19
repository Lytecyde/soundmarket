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

function quantizeToScale(midi, scale = [2, 3, 6, 7, 9, 10, 1]) {
    const octave = Math.floor(midi / 12);
    const noteInOctave = midi % 12;
    const closest = scale.reduce((prev, curr) =>
        Math.abs(curr - noteInOctave) < Math.abs(prev - noteInOctave) ? curr : prev
    );
    return octave * 12 + closest;
}

function playWithTone() {
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const synth = new Tone.PolySynth(Tone.AMSynth, {
        maxPolyphony: 4,
        volume: -8,
        options: {
            harmonicity: 1.25,
            modulationIndex: 1.5,
            envelope: {
                attack: 1.2,
                decay: 0.5,
                sustain: 0.9,
                release: 3
            },
            modulationEnvelope: {
                attack: 0.8,
                decay: 0.4,
                sustain: 0.7,
                release: 2.5
            },
            oscillator: { type: "sine" },
            modulation: { type: "sine" }
        }
    });

    const filter = new Tone.Filter({
        frequency: 1000,
        Q: 0.5,
        type: "lowpass"
    });

    const reverb = new Tone.Reverb({ decay: 6, wet: 0.5 }).toDestination();

    synth.connect(filter);
    filter.connect(reverb);

    // Gentle LFO on filter to simulate bow pressure variation
    const filterLFO = new Tone.LFO({
        frequency: 0.1,
        min: 700,
        max: 1400
    }).start();
    filterLFO.connect(filter.frequency);

    let index = 0;

    const loop = new Tone.Loop((time) => {
        if (index >= prices.length) {
            Tone.Transport.stop();
            loop.dispose();
            return;
        }

        const price = prices[index];

        // Hungarian Minor scale
        const rawMidi = 40 + (price.Price - minPrice) * 0.3;
        const quantizedMidi = quantizeToScale(Math.round(rawMidi), [2, 3, 6, 7, 9, 10, 1]);
        const freq = Tone.Frequency(quantizedMidi, "midi").toFrequency();

        synth.triggerAttackRelease(freq, "2n", time);

        played[index] = price.Price;
        chart.update();

        index++;
    }, "4n");

    loop.start(0);
    Tone.Transport.bpm.value = 120;
    Tone.Transport.start();
}
