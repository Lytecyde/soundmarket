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

        const chordChange = sentimentChordChange(index);

        synth.triggerAttackRelease(chordChange[0], "4n",time);
        synth.triggerAttackRelease(chordChange[1], "4n", time + 0.25);
        synth.triggerAttackRelease(chordChange[2], "4n", time + 0.75);
        played[index] = price.Price;
        chart.update();

        index++;
    }, "4n");

    loop.start(0);
    Tone.Transport.bpm.value = 120;
    Tone.Transport.start();
}

function sentiment(index) {
    if (index === 0) {
        return "gray"; // Return directly for first element
    }

    const change = prices[index].Change;
    const lastChange = prices[index - 1].Change;
    const trendGrowing = prices[index].Price > prices[index - 1].Price;

    let sentimentType = "neutral"; // Default sentiment

    if (change > 0 && lastChange > 0 && trendGrowing) {
        sentimentType = "Pleasant High Energy"; // Happy
    } else if (change < 0 && lastChange < 0 && !trendGrowing) {
        sentimentType = "Unpleasant Low Energy"; // Calm
    } else if (change < 0 && lastChange < 0 && trendGrowing) {
        sentimentType = "Unpleasant High Energy"; // Angry
    } else if (change > 0 && lastChange > 0 && !trendGrowing) {
        sentimentType = "Pleasant Low Energy"; // Sad
    }

    const sentimentColors = {
        "Pleasant High Energy": "yellow",
        "Pleasant Low Energy": "green",
        "Unpleasant High Energy": "red",
        "Unpleasant Low Energy": "blue",
        "neutral": "gray"
    };

    return sentimentColors[sentimentType];
}

function sentimentChordChange(index) {
    let songSoFar = [];
    const s = sentiment(index);

    // Musical sentiment definitions
    const musicalSentiments = {
        "yellow": [["F4","A4","C4"], ["G4","B#4","D4"], ["A5","C4","E4"]], // Happy
        "green": [["G4","B4","D4"], ["D5","F#5","A5"], ["E5","G5","B5"]], // Calm
        "blue": [["E4","G4","B4"], ["C4","E4","G4"], ["A5","C5","E5"]], // Sad
        "red": [["C4","E4","G4"], ["E4","G4","B5"], ["G4","B5","D5"]], // Angry
        "gray": [["E4","G4","B4"], ["G4","B5","D4"], ["C5","E5","G4"]] // Neutral
    };

    songSoFar.push(s);

    // Select the first chord based on sentiment color
    let chordOf3Notes = musicalSentiments[s]?.[0] || ["C", "E", "G"];
    let chordChange = musicalSentiments[s];
    return chordChange;
}