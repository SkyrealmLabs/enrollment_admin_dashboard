// Function to add padding to the ID to make it longer
function addPadding(val) {
    const randomPadding = Math.random().toString(36).substring(2, 10); // Generate a random string
    return `${randomPadding}-${val}-${randomPadding}`; // Add padding to both sides of the ID
}

// Function to encode the ID (Base64 encoding example)
function encode(val) {
    const paddedId = addPadding(val); // Add padding to make it longer
    const encodedId = new TextEncoder().encode(paddedId); // Convert the value to a byte array
    return btoa(String.fromCharCode(...encodedId)); // Encode the byte array to Base64
}

// Function to remove the padding when decoding the ID
function removePadding(paddedVal) {
    const parts = paddedVal.split('-'); // Split by the padding separator
    return parts[1]; // Return the original ID part
}

// Function to decode the ID (Base64 decoding)
function decode(val) {
    const decodedBase64 = atob(val); // Decode the Base64 string to a binary string
    const decodedArray = new Uint8Array([...decodedBase64].map(char => char.charCodeAt(0))); // Convert binary string to byte array
    const paddedId = new TextDecoder().decode(decodedArray); // Convert byte array back to string
    return removePadding(paddedId); // Remove padding and get the original ID
}