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
                attack: 0.1,
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

        console.log(chordChange);

        synth.triggerAttackRelease(chordChange[0], "8n", time); //first chord of chord change
        synth.triggerAttackRelease(chordChange[1], "8n", time + 1/3 ); // 2nd chord of chord change
        synth.triggerAttackRelease(chordChange[2], "8n", time + 2/3 ); // 3rd chord of chord change

        played[index] = price.Price;
        chart.update();

        index++;
    }, "2n");

    loop.start(0);
    Tone.Transport.bpm.value = 60;// comment 
    Tone.Transport.start();
}

const SentimentHappy = "happy";
const SentimentSad = "sad";
const SentimentAngry = "angry";
const SentimentCalm = "calm";
const SentimentNeutral = "neutral";

const sentimentColors = {
    SentimentHappy: "Pleasant High Energy",
    SentimentCalm: "Pleasant Low Energy",
    SentimentAngry: "Unpleasant High Energy",
    SentimentBlue: "Unpleasant Low Energy",
    SentimentNeutral: "neutral",
};

function sentiment(index) {
    if (index === 0) {
        return SentimentNeutral; // Return directly for first element
    }

    let price = prices[index].Price;
    let lastPrice = prices[index - 1].Price;

    const change = price.Change;
    const lastChange = lastPrice.Change;
    const trendGrowing = price.Price > lastPrice.Price;

    if (change > 0 && lastChange > 0 && trendGrowing) {
        return SentimentHappy;
    } else if (change < 0 && lastChange < 0 && !trendGrowing) {
        return SentimentCalm;
    } else if (change < 0 && lastChange < 0 && trendGrowing) {
        return SentimentAngry;
    } else if (change > 0 && lastChange > 0 && !trendGrowing) {
        return SentimentSad;
    }

    return SentimentNeutral;
}

// Musical sentiment definitions
function musicalSentiment(sentimentName) {
    switch (sentimentName) {
        case SentimentHappy:
            return [["F4", "A4", "C4"], ["G4", "B#4", "D4"], ["A5", "C4", "E4"]];
        case SentimentCalm:
            return [["G4", "B4", "D4"], ["D5", "F#5", "A5"], ["E5", "G5", "B5"]];
        case SentimentSad:
            return [["E4", "G4", "B4"], ["C4", "E4", "G4"], ["A5", "C5", "E5"]];
        case SentimentAngry:
            return [["C4", "E4", "G4"], ["E4", "G4", "B5"], ["G4", "B5", "D5"]];
        case SentimentNeutral:
            return [["E4", "G4", "B4"], ["G4", "B5", "D4"], ["C5", "E5", "G4"]];
    }
};

function sentimentChordChange(index) {
    let songSoFar = [];
    const sentimentName = sentiment(index);

    console.log("s", sentimentName);

    songSoFar.push(sentimentName);

    // Select the first chord based on sentiment color
    let chordChange = musicalSentiment(sentimentName);

    console.log("chordChange", chordChange);

    return chordChange;
}