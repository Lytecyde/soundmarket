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

function startMusic() {
    console.log('Starting sound market...');
}