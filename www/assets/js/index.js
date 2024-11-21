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

        getAllLocations();
    } catch (error) {
        console.error('Error:', error);
        alert('Error accessing protected route: ' + error.message);
        logout();
    }
}

async function getAllLocations() {
    try {
        const response = await fetch('/api/location/get'); // Call the backend API
        const result = await response.json(); // Parse the JSON response

        if (response.ok) {
            filterData(result.data); // Pass the data to generateTableRows
        } else {
            console.error('Error fetching locations:', result.message);
        }
    } catch (error) {
        console.error('Network error:', error);
        document.getElementById('table-body').innerHTML = '<tr><td colspan="5">Network error while fetching locations</td></tr>';
    }
}

function filterData(data) {
    
    const locationData = data;

    const result = locationData.reduce((acc, item) => {
        if (item.status === "pending") {
            acc.pending++;
        } else if (item.status === "approved") {
            acc.approved++;
        } else if (item.status === "rejected") {
            acc.rejected++;
        }
        return acc;
    }, { pending: 0, approved: 0, rejected: 0 });

    
    console.log("🚀 ~ filterData ~ result:", result)
    
    mapDataToHTML(result);

}

function mapDataToHTML(result) {
    document.getElementById('status1').innerText = result.pending;
    animateCount('status1', result.pending);
    document.getElementById('status2').innerText = result.approved;
    animateCount('status2', result.approved);
    document.getElementById('status3').innerText = result.rejected;
    animateCount('status3', result.rejected);
}

function animateCount(id, target) {
    const element = document.getElementById(id);
    let currentCount = 0;
    const increment = target / 100; // Adjust the speed by changing this divisor
    const interval = setInterval(() => {
        currentCount += increment;
        element.innerText = Math.floor(currentCount);

        if (currentCount >= target) {
            clearInterval(interval);
            element.innerText = target; // Ensure final value is accurate
        }
    }, 1); // Adjust the speed of the animation by changing the interval time
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

