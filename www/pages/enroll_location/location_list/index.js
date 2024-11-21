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

        fetchLocations();
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

async function fetchLocations() {
    try {
        const response = await fetch('/api/location/get'); // Call the backend API
        const result = await response.json(); // Parse the JSON response

        if (response.ok) {
            generateTableRows(result.data); // Pass the data to generateTableRows
        } else {
            console.error('Error fetching locations:', result.message);
            document.getElementById('table-body').innerHTML = '<tr><td colspan="5">Error fetching locations</td></tr>';
        }
    } catch (error) {
        console.error('Network error:', error);
        document.getElementById('table-body').innerHTML = '<tr><td colspan="5">Network error while fetching locations</td></tr>';
    }
}

function viewLocation(id) {
    const encryptedId = encode(id); // Encrypt the ID
    window.location.href = `../location_details/?id=${encodeURIComponent(encryptedId)}`; // Pass the encrypted ID in the URL
}

function generateTableRows(data) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = "";

    data.forEach((item, index) => {
        let actionContent;
        let statusBadge;

        if (item.status === 'pending') {
            actionContent = `
                <a href="javascript:;" onclick='viewLocation(${JSON.stringify(item.id)})' data-bs-toggle="tooltip" data-bs-original-title="View Location">
                    <i class="material-icons text-secondary position-relative text-lg">visibility</i>
                </a>
                <a href="javascript:confirmation();" class="mx-3" data-bs-toggle="tooltip" data-bs-original-title="Enroll">
                    <i class="material-icons text-secondary position-relative text-lg">edit_location_alt</i>
                </a>`;
                    statusBadge = '<span class="badge badge-warning">' + item.status + '</span>';
                } else if (item.status === 'approved') {
                    actionContent = `
                <a href="javascript:;" onclick='viewLocation(${JSON.stringify(item.id)})' data-bs-toggle="tooltip" data-bs-original-title="View Location">
                    <i class="material-icons text-secondary position-relative text-lg">visibility</i>
                </a>`;
                    statusBadge = '<span class="badge badge-success">' + item.status + '</span>';
                } else if (item.status === 'rejected') {
                    actionContent = `
                <a href="javascript:;" onclick='viewLocation(${JSON.stringify(item.id)})' data-bs-toggle="tooltip" data-bs-original-title="View Location">
                    <i class="material-icons text-secondary position-relative text-lg">visibility</i>
                </a>`;
                    statusBadge = '<span class="badge badge-danger">' + item.status + '</span>';
        }

        const row = `
            <tr>
                <td class="text-sm">${index + 1}</td>
                <td><div class="d-flex"><h6 class="my-auto">${item.locationAddress}</h6></div></td>
                <td class="text-sm">${item.name}</td>
                <td class="text-sm">${item.email}</td>
                <td class="text-sm">${statusBadge}</td>
                <td class="text-sm">${actionContent}</td>
            </tr>`;

        tableBody.innerHTML += row;
    });
}