let prices = [], chart, played = [], minPrice = null, maxPrice = 0;

// Using pure JS, after page has loaded, load the data from the JSON file
document.addEventListener("DOMContentLoaded", function() {
    // Fetch the JSON data
    fetch('https://raw.githubusercontent.com/tanel/soundmarket/refs/heads/main/msci_emerging_markets_converted.json')
        .then(response => response.json())
        .then(data => {
            prices = parseData(data);
            played = new Array(prices.length).fill(null);
        })
        .catch(error => console.error('Error fetching data:', error));
});

//attach a click listener to a play button
document.addEventListener("click", async () => {
    await Tone.start();
    displayGraph();
    playWithTone();
    console.log("audio is ready");
});

const noteDurationList = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

function playWithTone() {
    let index = 0;
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();

    // Clear previous schedules and stop the transport
    Tone.Transport.stop();
    Tone.Transport.cancel(); // clear previous schedules

    Tone.Transport.scheduleRepeat((time) => {
        if (index >= prices.length) {
            Tone.Transport.stop();
            return;
        }

        let price = prices[index];

        const high = price.High - minPrice;
        const durationIndex = Math.floor(Math.log(high)) % noteDurationList.length;
        const noteDuration = noteDurationList[durationIndex];

        if (price) {
            let normalizedPrice = price.Price - minPrice;
            const freq = 100 + normalizedPrice;
            const duration = noteDuration + "n";
            console.log(freq, duration, time);
            synth.triggerAttackRelease(freq, duration , time);
        }

        // update chart
        played[index] = price.Price;
        chart.update();

        index++;
    }, "8n");

    Tone.Transport.start();
}

function parseNumeric(value) {
    return parseFloat(value.replace(",", ""))
}

function parseData(data) {
    return data.reverse().map(x => {
        const price = {
            Date: x.Date,
            Price: parseNumeric(x.Price),
            High: parseNumeric(x.High),
            Open: parseNumeric(x.Open),
            Low: parseNumeric(x.Low),
        };

        if (!minPrice) {
            minPrice = price.Price;
        } else {
            minPrice = Math.min(minPrice, price.Price);
        }

        maxPrice = Math.max(maxPrice, price.Price);

        return price;
    });
}

function displayGraph() {
    const ctx = document.getElementById("chart").getContext("2d");

    console.log("minPrice", minPrice);
    console.log("maxPrice", maxPrice);

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: prices.map(x => { return x.Date; }),
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
                    data: prices.map(x => { return x.Price; }),
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
