let locationID;

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');
    const username = document.getElementById("username");
    if (!token) {
        // Redirect to login if no token is present
        location.href = "pages/authentication/login/"; // Redirect to login page
    } else {
        await accessProtectedRoute(); // Call to access protected data
    }

    const user = JSON.parse(sessionStorage.getItem('user'));

    if (user) {
        username.innerText = user.name
    } else {
        console.log("No user logged in.");
    }
});

async function accessProtectedRoute() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/protected', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            logout();
            throw new Error('Access denied');
        }

        const data = await response.json();
        console.log('Protected data:', data);

        getEncryptedID();
    } catch (error) {
        console.error('Error:', error);
        alert('Error accessing protected route: ' + error.message);
        logout();
    }
}

async function logout() {
    try {
        // Clear the token from local storage
        localStorage.removeItem('token'); // or sessionStorage.removeItem('token');

        // Redirect the user to the login page
        window.location.replace("pages/authentication/login/");
    } catch (error) {
        console.error("Error during logout:", error);
    }
};

async function getEncryptedID() {
    // Extract the ID from the URL
    const params = new URLSearchParams(window.location.search);
    const encryptedId = params.get('id'); // Get the encrypted ID

    if (encryptedId) {
        try {
            // Decrypt the ID
            const decryptedId = decode(encryptedId); // Call your decrypt function

            // Fetch the location details using the decrypted ID
            locationID = decryptedId;
            await fetchLocationDetails(decryptedId);
        } catch (error) {
            console.error('Error decrypting ID:', error);
            displayErrorMessage('Error decrypting ID');
        }
    } else {
        displayErrorMessage('No ID found in the URL');
    }
}

async function fetchLocationDetails(id) {
    try {
        const response = await fetch('/api/location/getLocationDetailsById', {
            method: 'POST', // Specify the method as POST
            headers: {
                'Content-Type': 'application/json' // Set the content type to JSON
            },
            body: JSON.stringify({ ID: id }) // Include the ID in the request body
        });

        const result = await response.json(); // Parse the JSON response

        if (response.ok) {
            displayLocationDetails(result.data); // Call the function to display location details
        } else {
            console.error('Error fetching locations:', result.message);
            displayErrorMessage('Error fetching locations: ' + result.message);
        }
    } catch (error) {
        console.error('Network error:', error);
        displayErrorMessage('Network error while fetching locations');
    }
}

function displayErrorMessage(message) {
    // Implement this function to show error messages to the user
    console.error(message); // For debugging
    // You can also display it on the page if needed
}

function displayLocationDetails(locationData) {
    var person = document.getElementById("person");
    var email = document.getElementById("email");
    var location_coordinate = document.getElementById("location_coordinate");
    var address = document.getElementById("address");
    var status = document.getElementById("status");
    var status_badge = document.getElementById("status_badge")
    var video_source = document.getElementById("videoSource");

    if (locationData) {
        person.innerText = locationData[0].name;
        email.innerText = locationData[0].email;
        location_coordinate.innerText = locationData[0].latitude + ", " + locationData[0].longitude;
        address.innerText = locationData[0].locationAddress;
        video_source.src = locationData[0].mediaPath.split('\\').pop();

        if (locationData[0].status === 'pending') {
            status.innerHTML = `<div class="col-lg-6">
                                    <button onclick="review()" class="btn bg-gradient-info mb-0 mt-lg-auto w-100" type="button"
                                        name="button">Review</button>
                                </div>`
            status_badge.innerHTML = `<span class="badge badge-warning">${locationData[0].status}</span>`
        } else if (locationData[0].status === 'approved') {
            status.innerHTML = `<div class="col-lg-6">
                                    <button onclick="review()" class="btn bg-gradient-primary mb-0 mt-lg-auto w-100" type="button"
                                        name="button">Review</button>
                                </div>`
            status_badge.innerHTML = `<span class="badge badge-success">${locationData[0].status}</span>`
        } else {
            status.innerHTML = `<div class="col-lg-6">
                                    <button onclick="review()" class="btn bg-gradient-primary mb-0 mt-lg-auto w-100" type="button"
                                        name="button">Review</button>
                                </div>`
            status_badge.innerHTML = `<span class="badge badge-danger">${locationData[0].status}</span>`
        }

    }
}

function review() {
    Swal.fire({
        title: 'What would you like to do?',
        text: 'You can either approve, reject, or cancel this enrollment.',
        icon: 'question',
        showDenyButton: true,            // Show "Reject" button
        showCancelButton: true,          // Show "Cancel" button
        confirmButtonText: 'Approve',    // Text for "Approve" button
        denyButtonText: 'Reject',        // Text for "Reject" button
        cancelButtonText: 'Cancel',      // Text for "Cancel" button
        confirmButtonColor: '#28a745',   // Green for approve
        denyButtonColor: '#d33',         // Red for reject
        cancelButtonColor: '#6c757d'     // Grey for cancel
    }).then((result) => {
        if (result.isConfirmed) {

            enroll('approve');

        } else if (result.isDenied) {

            enroll('reject');

        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Action if the user clicked 'Cancel'
            Swal.fire({
                title: 'Cancelled!',
                text: 'You have canceled the action.',
                icon: 'info'
            });
        }
    });
}

function enroll(action) {
    let locationStatusId;
    let actionText;

    // Determine the status and corresponding action text
    if (action === 'approve') {
        locationStatusId = 2; // 2 means approved
        actionText = 'approved';
    } else if (action === 'reject') {
        locationStatusId = 3; // 3 means rejected
        actionText = 'rejected';
    } else {
        Swal.fire({
            title: 'Error!',
            text: 'Invalid action specified.',
            icon: 'error'
        });
        return;
    }

    // Retrieve user information for logging
    const user = JSON.parse(sessionStorage.getItem('user'));

    // Call the API with the determined locationStatusId and locationId
    fetch('/api/location/review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            locationStatusId: locationStatusId,
            id: locationID
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Show a success message with either approved or rejected
                Swal.fire({
                    title: 'Success!',
                    text: `Location has been successfully ${actionText}.`, // Approved or Rejected
                    icon: 'success'
                }).then(() => {
                    // Call the logging API to log the review action
                    logReviewAction(user, locationID, actionText);
                    // Redirect to the previous page after approval
                    // window.location.href = document.referrer;
                });
            } else {
                Swal.fire({
                    title: 'Error!',
                    text: 'Failed to update location.',
                    icon: 'error'
                });
            }
        })
        .catch(error => {
            console.error('Error updating location:', error);
            Swal.fire({
                title: 'Error!',
                text: 'An error occurred during the update process.',
                icon: 'error'
            });
        });
}

// Logging API function to log the review action
function logReviewAction(user, locationID, action) {
    fetch('/api/location/enrollment/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userID: user?.id,
            userName: user?.name,
            locationID: locationID,
            action: action
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Logging failed');
        }
        return response.json();
    })
    // .then(data => {
    //     console.log('Action logged successfully:', data);
    // })
    .catch(error => {
        console.error('Error logging action:', error);
    });
}