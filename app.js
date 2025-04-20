let prices = [], chart, played = [], minPrice = Infinity, maxPrice = 0;
let loop = null; // Keep track of the loop instance
let isAudioReady = false; // Flag for initial setup
let indexChord = 0;
const colorsOfSentiment = ["yellow", "green", "blue", "red"];

document.addEventListener("DOMContentLoaded", function () {
    fetch('https://raw.githubusercontent.com/tanel/soundmarket/refs/heads/main/msci_emerging_markets_converted.json')
        .then(response => response.json())
        .then(data => {
            prices = parseData(data);
            played = new Array(prices.length).fill(null);
            // Enable the button only after data is loaded
            const playButton = document.getElementById("playStopButton");
            if (playButton) {
                playButton.disabled = false;
            }

        })
        .catch(error => {
            console.error('Error fetching data:', error);

            // Optionally disable or hide the button if data fails
            const playButton = document.getElementById("playStopButton");
            if (playButton) {
                playButton.textContent = "Error loading data";
                playButton.disabled = true;
            }
        });
    // Add listener for the button
    const playButton = document.getElementById("playStopButton");
    if (playButton) {
        playButton.disabled = true; // Disable until data loads
        playButton.addEventListener("click", togglePlayback);
    } else {
        console.error("Button with id 'playStopButton' not found.");
    }
});

// This function now only runs once on the first interaction to set up Tone.js context
async function initialSetup() {
    if (!isAudioReady) {
        try {
            await Tone.start();
            console.log("Audio Context is ready");
            displayGraph();
            isAudioReady = true;
            // Optional: Update button text or state if needed after setup
            // const playButton = document.getElementById("playStopButton");
            // if (playButton) playButton.textContent = "Start";
        } catch (e) {
            console.error("Error starting Tone.js:", e);
            // Handle error, maybe disable the button
            const playButton = document.getElementById("playStopButton");
            if (playButton) {
                playButton.textContent = "Audio Error";
                playButton.disabled = true;
            }
        }
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
    if (!prices || prices.length === 0) {
        console.error("No price data available to display graph.");
        return;
    }
    if (chart) {
        chart.destroy(); // Destroy previous chart instance if exists
    }

    const ctx = document.getElementById("chart").getContext("2d");

    // Reset 'played' array for potentially new data or replay
    played = new Array(prices.length).fill(null);

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

// Renamed and modified to only set up the sound and loop
function setupPlayback() {
    // Clean up previous transport events and loop if they exist
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (loop) {
        loop.dispose();
        loop = null;
    }
    // Reset the 'played' data and update chart
    played = new Array(prices.length).fill(null);
    if (chart) {
        chart.data.datasets[0].data = played;
        chart.update('none'); // Update chart without animation
    }


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
    }).toDestination(); // Connect directly for now, simplify chain

    // --- Effects Chain (Optional - Add back if needed) ---
    // const filter = new Tone.Filter({ frequency: 1000, Q: 0.5, type: "lowpass" });
    // const reverb = new Tone.Reverb({ decay: 6, wet: 0.5 }).toDestination();
    // synth.connect(filter);
    // filter.connect(reverb);
    // const filterLFO = new Tone.LFO({ frequency: 0.1, min: 700, max: 1400 }).start();
    // filterLFO.connect(filter.frequency);
    // --- End Effects Chain ---

    let index = 0;

    // Assign the created loop to the global `loop` variable
    loop = new Tone.Loop((time) => {
        if (!prices || index >= prices.length) {
            console.log("Playback finished or prices data missing.");
            // Stop transport and update button when loop naturally finishes
            Tone.Transport.stop();
            const playButton = document.getElementById("playStopButton");
            if (playButton) playButton.textContent = "Start";
            if (loop) loop.dispose(); // Clean up the loop itself
            loop = null;
            return;
        }

        const price = prices[index];
        if (!price) {
            console.error(`Price data undefined at index ${index}`);
            index++; // Skip this iteration
            return;
        }

        const chordChange = sentimentChordChange(index);

        // Ensure chordChange is valid before triggering
        if (chordChange && chordChange.length === 2) {
            // Add a small offset to prevent clicks if notes are too close
            synth.triggerAttackRelease(chordChange[0], "8n", time, 0.9);
            synth.triggerAttackRelease(chordChange[1], "8n", time + Tone.Time("16n").toSeconds(), 0.9); // Adjusted timing
        } else {
            console.warn(`Invalid chordChange at index ${index}:`, chordChange);
        }


        // Update chart data
        played[index] = price.Price;
        // Update chart efficiently: only change data, no full redraw animation
        if (chart) {
            chart.data.datasets[0].data = played; // Update the played data reference
            // Optimize chart update - consider 'none' for less visual jitter during playback
            chart.update('none'); // 'none' prevents animation, potentially smoother
        } else {
            console.warn("Chart not available for update");
        }


        index++;
    }, "2n"); // Changed interval to "2n" (half note) for potentially slower playback

    // Set BPM here before starting transport elsewhere
    Tone.Transport.bpm.value = 90; // Example BPM adjustment

    loop.start(0); // Start the loop scheduling immediately (relative to transport start)

    console.log("Playback setup complete. Loop scheduled.");
    // DO NOT start transport here - togglePlayback will handle it
    // Tone.Transport.start();
}

async function togglePlayback() {
    // Ensure audio context is started (required on first user gesture)
    await initialSetup();
    if (!isAudioReady) {
        console.warn("Audio context not ready yet. Click again maybe?");
        // Optionally provide user feedback here
        return;
    }


    const playButton = document.getElementById("playStopButton");
    if (!playButton) return; // Exit if button doesn't exist

    if (Tone.Transport.state === "started") {
        // --- Stop Playback ---
        Tone.Transport.stop();
        // Optional: Cancel scheduled events if stopping abruptly
        Tone.Transport.cancel();
        // Optional: Dispose loop immediately on stop if desired
        if (loop) {
            loop.dispose();
            loop = null;
        }
        // Reset played data on stop if you want the red line to disappear
        played = new Array(prices.length).fill(null);
        if (chart) {
            chart.data.datasets[0].data = played;
            chart.update('none');
        }

        playButton.textContent = "Start";
        console.log("Playback stopped.");
    } else {
        // --- Start Playback ---
        if (!prices || prices.length === 0) {
            console.error("Cannot start playback: Price data not loaded or empty.");
            return; // Don't start if no data
        }
        console.log("Setting up playback...");
        setupPlayback(); // Set up the synths and loop

        // Ensure loop is valid before starting transport
        if (loop) {
            console.log("Starting transport...");
            Tone.Transport.start();
            playButton.textContent = "Stop";
            console.log("Playback started.");
        } else {
            console.error("Loop setup failed. Cannot start transport.");
            playButton.textContent = "Error"; // Indicate an issue
        }
    }
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
        "yellow": [["F4","A4","C4"], ["G4","B4","D4"]], // Happy
        "green": [["G4","B4","D4"], ["F4","A4","C4"]], // Calm
        "blue": [["E4","G4","B4"], ["A4","C4","E4"]], // Sad
        "red": [["C4","E4","G4"], ["E4","G4","B4"]], // Angry
        "gray": [ ["C4","E4","G4"], ["C4","E4","G4"]] // Neutral
    };

    songSoFar.push(s);

    // Select the first chord based on sentiment color
    return musicalSentiments[s];
}

function testSongs (sentiment){

}

/**
 * Stops current playback and plays only the "yellow" sentiment chords repeatedly.
 * Assumes Tone.start() has been called previously.
 */
function testYellowSong(indexChord) {
    console.log("Starting sentiment test song...");

    // 1. Stop and clean up any existing playback
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (loop) { // Use the global loop variable if it exists
        loop.dispose();
        loop = null;
    }
    // Optional: Update the main button text if it exists
    const playButton = document.getElementById("playStopButton");
    if (playButton) {
        playButton.textContent = "Start"; // Reset main button if stopping playback
    }
    const testYellowButton = document.getElementById("testYellowButton");
        testYellowButton.style.backgroundColor = colorsOfSentiment[indexChord];
        testYellowButton.style.color = "black";
    // 2. Define the synth (same as used in setupPlayback for consistency)
    const synth = new Tone.PolySynth(Tone.AMSynth, {
        maxPolyphony: 4,
        volume: -8,
        options: {
            harmonicity: 1.25,
            modulationIndex: 1.5,
            envelope: { attack: 0.1, decay: 0.5, sustain: 0.9, release: 3 },
            modulationEnvelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.5 },
            oscillator: { type: "sawtooth" },
            modulation: { type: "sine" }
        }
    }).toDestination(); // Connect directly to output

    // 3. Get the specific chords
    const testChords = [
        [["F4", "A4", "C4"], ["G4", "B4", "D4"]],
        [["G4","B4","D4"], ["F4","A4","C4"]],
        [["E4","G4","B4"], ["A4","C4","E4"]],
        [["C4","E4","G4"], ["E4","G4","B4"]]
    ];
    const emotionType = ["happy","calm","sad","angry"];
    // 4. Create a new loop specifically for this test
    const testLoop = new Tone.Loop((time) => {
        // Play the first yellow chord
        synth.triggerAttackRelease(testChords[indexChord][0], "8n", time, 1);
        // Play the second yellow chord halfway through the loop interval
        synth.triggerAttackRelease(testChords[indexChord][1], "8n", time + Tone.Time("8n").toSeconds(), 1); // Play on the next 8th note

        console.log("Played "+ emotionType[indexChord] +"chords at time:", time);

    }, "2n"); // Loop every whole note ("1n") - adjust timing as desired "4n" = whole note

    // 5. Set transport settings and start
    Tone.Transport.bpm.value = 100; // Set desired tempo
    testLoop.start(0); // Start the loop scheduling immediately
    Tone.Transport.start(); // Start the transport

    console.log(" test song playing.");

    // Assign this loop to the global variable so it can be stopped by togglePlayback or another call
    loop = testLoop;

    // Optional: Update the main button to reflect this test is running
    if (playButton) {
        playButton.textContent = "Stop Test"; // Indicate test is running
        // Note: Clicking this button now will call togglePlayback,
        // which will stop this test loop.
    }
}
document.addEventListener("DOMContentLoaded", function () {
    // ... (existing setup) ...

    const testButton = document.getElementById("testYellowButton");
    if (testButton) {
        testButton.addEventListener("click", async () => {
            await initialSetup(); // Make sure audio context is ready
            if (isAudioReady) {
                testYellowSong(indexChord);
                if(indexChord === 3) {
                    indexChord = 0;
                }
                else {
                    indexChord++;
                }
            } else {
                console.error("Audio context not ready for test song.");
            }
        });
    }
});