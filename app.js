// Using pure JS, after page has loaded, load the data from the JSON file
document.addEventListener("DOMContentLoaded", function() {
    // Fetch the JSON data
    fetch('https://raw.githubusercontent.com/tanel/soundmarket/refs/heads/main/msci_emerging_markets_converted.json')
        .then(response => response.json())
        .then(data => {
            // Call the function to display the data
            startMusic(data);
        })
        .catch(error => console.error('Error fetching data:', error));
});

//attach a click listener to a play button
document.addEventListener("click", async () => {
    await Tone.start();
    console.log("audio is ready");
});

function startMusic(data) {
    console.log('Starting sound market...');
    modulateSynthFromData(data);
}

// Assume `data` is the JSON array
function modulateSynthFromData(data) {
    const synth = new Tone.MonoSynth({
        oscillator: { type: "square" },
        filter: { Q: 2, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1 },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 0.2,
            release: 0.8,
            baseFrequency: 200,
            octaves: 2.6,
        }
    }).toDestination();

    const now = Tone.now();

    data.slice(0, 16).forEach((row, i) => {
        const price = parseFloat(row.Price.replace(",", "")) || 400;
        const change = parseFloat(row["Change %"].replace("%", "")) || 0;

        // Map price to pitch range (e.g. 200–1000 Hz)
        const freq = 200 + (price % 800);
        const duration = "8n";

        // Modulate filter envelope base frequency by % change
        synth.set({
            filterEnvelope: {
                baseFrequency: 200 + Math.abs(change) * 100
            }
        });

        synth.triggerAttackRelease(freq, duration, now + i * 0.3);
    });
}
