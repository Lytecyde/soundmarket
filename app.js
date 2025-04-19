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

function playWithTone() {
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: {
            attack: 0.6,
            decay: 0.4,
            sustain: 0.8,
            release: 1.5
        }
    }).toDestination();

    let index = 0;

    const loop = new Tone.Loop((time) => {
        if (index >= prices.length) {
            Tone.Transport.stop();
            loop.dispose();
            return;
        }

        const price = prices[index];
        const freq = 100 + (price.Price - minPrice);

        synth.triggerAttackRelease(freq, "2n", time);

        played[index] = price.Price;
        chart.update();

        index++;
    }, "2n"); // every half note

    loop.start(0);
    Tone.Transport.bpm.value = 120;
    Tone.Transport.start();
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
