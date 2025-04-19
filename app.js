let prices = [], chart, played = [], minPrice = Infinity, maxPrice = 0;

document.addEventListener("DOMContentLoaded", function() {
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

function playWithTone() {
    let index = 0;
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();

    Tone.Transport.stop();
    Tone.Transport.cancel();

    Tone.Transport.scheduleRepeat((time) => {
        if (index >= prices.length) {
            Tone.Transport.stop();
            return;
        }

        let price = prices[index];

        const high = price.High - minPrice;
        const safeLog = Math.max(0, Math.log(high || 1));
        const durationIndex = Math.floor(safeLog) % noteDurationList.length;
        const noteDuration = noteDurationList[durationIndex];

        if (price) {
            let normalizedPrice = price.Price - minPrice;
            const freq = Math.min(1000, Math.max(100, 100 + normalizedPrice));
            const duration = noteDuration + "n";
            synth.triggerAttackRelease(freq, duration , time);
        }

        played[index] = price.Price;
        chart.update();
        index++;
    }, "8n");

    Tone.Transport.start();
}

function parseNumeric(value) {
    return parseFloat(value.replace(",", ""));
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
