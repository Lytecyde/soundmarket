// Using pure JS, after page has loaded, load the data from the JSON file
document.addEventListener("DOMContentLoaded", function() {
    // Fetch the JSON data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            // Call the function to display the data
            displayData(data);
        })
        .catch(error => console.error('Error fetching data:', error));
}