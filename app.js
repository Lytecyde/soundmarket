// Using pure JS, after page has loaded, load the data from the JSON file
document.addEventListener("DOMContentLoaded", function() {
    // Fetch the JSON data
    fetch('https://raw.githubusercontent.com/tanel/soundmarket/refs/heads/main/msci_emerging_markets_converted.json')
        .then(response => response.json())
        .then(data => {
            window.data = data;
        })
        .catch(error => console.error('Error fetching data:', error));
});

//attach a click listener to a play button
document.addEventListener("click", async () => {
    await Tone.start();
    let data = window.data;
    displayGraph(data);
    playWithTone(data);
    console.log("audio is ready");
});

// Assume `data` is the JSON array
function modulateSynthFromData(data) {
    const now = Tone.now();
    data.forEach((row, i) => {
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

function playWithTone() {
    let index = 0;
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

    Tone.Transport.cancel(); // clear previous schedules

    Tone.Transport.scheduleRepeat((time) => {
        if (index >= upcoming.length) {
            Tone.Transport.stop();
            return;
        }

        const freq = upcoming[index];
        if (freq) {
            synth.triggerAttackRelease(freq, "8n", time);
        }

        // update chart
        played[index] = freq;
        upcoming[index] = null;
        chart.update();

        index++;
    }, "8n");

    Tone.Transport.start();
}

let chart, played = [], upcoming = [], labels = [];

function displayGraph(data) {
    labels = data.map(r => r.Date).reverse();
    upcoming = data.map(r => parseFloat(r.Price.replace(",", ""))).reverse();
    played = new Array(upcoming.length).fill(null);

    const ctx = document.getElementById("chart").getContext("2d");

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
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
                    data: upcoming,
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
                y: { title: { display: true, text: "Price" } }
            }
        }
    });
}
