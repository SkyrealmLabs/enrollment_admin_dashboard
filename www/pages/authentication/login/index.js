async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = 'admin'; // Assuming admin role, you can adjust accordingly.
    const rememberMe = document.getElementById('rememberMe').checked; // Get the state of "Remember Me" checkbox

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, role }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token); // Store the token
            sessionStorage.setItem('user', JSON.stringify(data.user)); // Save the user data

            // Save email and password if "Remember Me" is checked
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email); // Save email to local storage
                localStorage.setItem('rememberedPassword', password); // Save password to local storage
            } else {
                localStorage.removeItem('rememberedEmail'); // Remove email from local storage if not checked
                localStorage.removeItem('rememberedPassword'); // Remove password from local storage if not checked
            }

            // alert(data.message);
            // After successful login, access the protected route
            await accessProtectedRoute(); // Call the function to access protected route
            location.href = "/"; // Redirect or update UI accordingly
        } else {
            // Handle error response
            alert(data.message); // Show error message
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Error during login, please try again.');
    }
}

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
            throw new Error('Access denied');
        }

        const data = await response.json();
        console.log('Protected data:', data);
    } catch (error) {
        console.error('Error:', error);
        alert('Error accessing protected route: ' + error.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const rememberedEmail = localStorage.getItem('rememberedEmail'); // Retrieve the remembered email
    const rememberedPassword = localStorage.getItem('rememberedPassword'); // Retrieve the remembered password

    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail; // Set the email input field
        document.getElementById('rememberMe').checked = true; // Check the checkbox
    }

    if (rememberedPassword) {
        document.getElementById('password').value = rememberedPassword; // Set the password input field
    }
});