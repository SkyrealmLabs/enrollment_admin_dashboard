const express = require("express");
const multer = require('multer');
const epf = require("express-php-fpm").default;
const os = require("os");
const { exec } = require("child_process");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const https = require('https');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const {
  JWT_SECRET,
  RECAPTCHA_SECRET,
  // UPLOAD_DIRECTORY
} = require('./constant');
const UPLOAD_DIRECTORY = path.join(__dirname, 'uploads');

let db;

// Initialize Express app
const httpWebApp = express();
httpWebApp.use(bodyParser.json()); // To parse JSON bodies

// Create MySQL connection
function handleDisconnect() {
  db = mysql.createConnection({
    host: '46.137.200.25',    // Your MySQL host
    user: 'skyrealm',         // Your MySQL username
    password: 'passw0rd',     // Your MySQL password
    database: 'skyintel',     // Your database name
    port: 3306,
  });

  db.connect(err => {
    if (err) {
      console.error('Error when connecting to the database:', err);
      setTimeout(handleDisconnect, 2000); // Retry after 2 seconds
    } else {
      console.log('Connected to MySQL Database');
    }
  });

  db.on('error', err => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      handleDisconnect(); // Reconnect if the connection is lost
    } else {
      throw err;
    }
  });
}

// Express-PHP-FPM configuration
const options = {
  documentRoot: path.join(__dirname, "www"),
  env: {},
  socketOptions: { port: 9000 }
};

// Serve static files from the www directory and assets
httpWebApp.use(express.static(path.join(__dirname, "www"))); // Serve main www directory
httpWebApp.use(express.static(path.join(__dirname, "www/assets"))); // Serve assets directory
httpWebApp.use("/scripts", express.static(path.join(__dirname, "node_modules/"))); // Serve node_modules for scripts

/**********************************************************************/
/**************************** Multer Storage ****************************/
/**********************************************************************/

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the upload directory exists
    if (!fs.existsSync(UPLOAD_DIRECTORY)) {
      fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true }); // Create the directory if it doesn't exist
    }

    cb(null, UPLOAD_DIRECTORY); // Save files to your specified path
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Get file extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`; // Generate unique file name
    cb(null, uniqueName); // Save file with unique name
  }
});

// Initialize multer with file filter for videos
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Define allowed MIME types
    const allowedMimeTypes = [
      "video/mp4",
      "video/quicktime", // For .mov files
      "video/x-msvideo", // For .avi files
      "video/x-ms-wmv", // For .wmv files
      "video/x-matroska", // For .mkv files
    ];
    const fileTypes = /mp4|mov|avi|wmv|mkv|quicktime/; // Allowed file extensions

    // Check if MIME type is valid
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    // Check if file extension is valid
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed!"), false);
    }
  },
});

/**********************************************************************/
/**************************** REGISTER API ****************************/
/**********************************************************************/
httpWebApp.post('/api/register', async (req, res) => {
  const { name, password, email, phoneno } = req.body;
  const timestamp = new Date(); // Define your timestamp here

  // Input validation
  if (!name || !password || !email || !phoneno) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if the user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE email = ?', [email], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO user (user_role_id, name, password, email, phoneno, isDeleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [3, name, hashedPassword, email, phoneno, false, timestamp, timestamp],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: "Server error" });
  }
});

/**********************************************************************/
/***************************** LOGIN API ******************************/
/**********************************************************************/
// Updated login API to filter for user and admin
httpWebApp.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body; // Include role in the request

  // Input validation
  if (!email || !password || !role) {
    return res.status(400).json({ message: "Email, password, and role are required" });
  }

  try {
    // Find the user in the database
    const user = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user WHERE email = ?', [email], (err, result) => {
        if (err) return reject(err);
        resolve(result.length > 0 ? result[0] : null);
      });
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if the user's role matches the role they are trying to log in as
    if (role === 'admin' && user.user_role_id !== 1) {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    } else if (role === 'user' && user.user_role_id !== 3) {
      return res.status(403).json({ message: "Unauthorized: User access required" });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user.id, role: role }, JWT_SECRET, { expiresIn: '1h' });

    // Send the response with user data, message, and token
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name, // Include other fields as necessary
        email: user.email,
        phoneno: user.phoneno,
        role: role // Include the role for the response
      }
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: "Error logging in" });
  }
});


/**********************************************************************/
/**************************** PROTECTED API ***************************/
/**********************************************************************/
httpWebApp.get('/api/protected', (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    res.status(200).json({ message: "You have access to this protected route" });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

/**********************************************************************/
/**************************** RECAPTCHA API ***************************/
/**********************************************************************/
httpWebApp.post('/api/verify-recaptcha', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const postData = querystring.stringify({
    secret: RECAPTCHA_SECRET,
    response: token,
  });

  const options = {
    hostname: 'www.google.com',
    path: '/recaptcha/api/siteverify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length,
    },
  };

  const request = https.request(options, (response) => {
    let data = '';

    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      const result = JSON.parse(data);
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, message: 'reCAPTCHA verification failed' });
      }
    });
  });

  request.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  });

  // Write data to request body
  request.write(postData);
  request.end();
});

/**********************************************************************/
/*************************** ADD LOCATION API *************************/
/**********************************************************************/
httpWebApp.post('/api/location/add', upload.single('media'), (req, res, next) => {
  const { userID, address, coordinate } = req.body;
  console.log("🚀 ~ httpWebApp.post ~ coordinate:", coordinate)
  console.log("🚀 ~ httpWebApp.post ~ address:", address)
  console.log("🚀 ~ httpWebApp.post ~ userID:", userID)
  // Check if all required fields are provided
  if (!address || !coordinate || !req.file) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Parse coordinate and round to 6 decimal places
  const parsedCoordinate = JSON.parse(coordinate);
  parsedCoordinate.latitude = parseFloat(parsedCoordinate.latitude).toFixed(6);
  parsedCoordinate.longitude = parseFloat(parsedCoordinate.longitude).toFixed(6);

  // Get the current timestamp
  const timestamp = new Date();

  // Add the new location to the database
  db.query("INSERT INTO location (userid, locationStatusId, locationAddress, latitude, longitude, mediaPath, isDeleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [userID, 1, address, parsedCoordinate.latitude, parsedCoordinate.longitude, req.file.path, false, timestamp, timestamp], (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }

      // Send response once the database operation is successful
      return res.status(201).json({
        message: "Location added successfully",
        address,
        coordinate: parsedCoordinate,
        mediaPath: req.file.path
      });
    });

  // Don't send another response here.
});

/**********************************************************************/
/*************************** GET LOCATION API *************************/
/**********************************************************************/
httpWebApp.get('/api/location/get', (req, res) => {
  // Query to get all non-deleted locations with status name
  const query = `
    SELECT l.id, l.userid, u.name, u.email, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath
    FROM location l
    INNER JOIN location_status ls ON l.locationStatusId = ls.id
    INNER JOIN user u ON l.userid = u.id
    WHERE l.isDeleted = false AND u.isDeleted = false;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Send back the results as a JSON response
    return res.status(200).json({
      message: "Locations fetched successfully",
      data: results
    });
  });
});

/**********************************************************************/
/********************** GET LOCATION BY USER ID API *******************/
/**********************************************************************/
httpWebApp.post('/api/location/getLocationByUserId', (req, res) => {
  const userID = req.body.userID; // Retrieve userID from the request body

  // Check if userID is provided
  if (!userID) {
    return res.status(400).json({ message: "User ID is required" });
  }

  // Query to get non-deleted locations for the specified user
  const query = `
    SELECT l.id, l.userid, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath
    FROM location l
    INNER JOIN location_status ls ON l.locationStatusId = ls.id
    WHERE l.isDeleted = false AND l.userid = ?
  `;

  db.query(query, [userID], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if the user has any locations
    if (results.length === 0) {
      return res.status(404).json({ message: "No locations found" });
    }

    // Send back the results as a JSON response
    return res.status(200).json({
      message: "Locations fetched successfully",
      totalLocations: results.length,
      data: results
    });
  });
});

/**********************************************************************/
/************************* GET LOCATION DETAILS BY ID API *********************/
/**********************************************************************/
httpWebApp.post('/api/location/getLocationDetailsById', (req, res) => {
  const ID = req.body.ID; // Retrieve ID from the request body

  // Check if ID is provided
  if (!ID) {
    return res.status(400).json({ message: "ID is required" });
  }

  // Query to get non-deleted locations for the specified user
  const query = `
    SELECT l.id, l.userid, u.name, u.email, ls.name AS status, l.locationAddress, l.latitude, l.longitude, l.mediaPath
    FROM skyrealm.location l
    INNER JOIN skyrealm.location_status ls ON l.locationStatusId = ls.id
    INNER JOIN skyrealm.user u ON l.userid = u.id
    WHERE l.isDeleted = false AND u.isDeleted = false AND l.id = ?
  `;

  db.query(query, [ID], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any locations were found
    if (results.length === 0) {
      return res.status(404).json({ message: "No locations found" });
    }

    // Send back the results as a JSON response
    return res.status(200).json({
      message: "Location details fetched successfully", // Adjusted message for clarity
      totalLocations: results.length,
      data: results
    });
  });
});

/**********************************************************************/
/*************************** Enroll Location **************************/
/**********************************************************************/
httpWebApp.post('/api/location/review', (req, res) => {
  const { locationStatusId, id } = req.body;

  // SQL query to update the location status and set updated_at to the current timestamp
  const query = `
    UPDATE location
    SET locationStatusId = ?, updated_at = NOW()
    WHERE id = ?;
  `;

  // Execute the query with the provided data
  db.query(query, [locationStatusId, id], (err, results) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any rows were affected (meaning the update was successful)
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    // Send back a success message
    return res.status(200).json({
      message: "Location updated successfully",
      data: results
    });
  });
});

/**********************************************************************/
/********************* LOG LOCATION ENROLLMENT REVIEW *****************/
/**********************************************************************/
httpWebApp.post('/api/location/enrollment/log', (req, res) => {
  const { userID, userName, locationID, action } = req.body;

  // Validate input
  if (!userID || !locationID || !action) {
    return res.status(400).json({ message: "User ID, Location ID, and Action are required" });
  }

  // Ensure action is either 'approve' or 'reject'
  const validActions = ['approved', 'rejected'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ message: "Invalid action. Allowed actions are 'approve' or 'reject'" });
  }

  // Prepare the log directory and file paths
  const timestamp = new Date().toISOString();
  const logDate = timestamp.slice(0, 10); // Format as YYYY-MM-DD
  const logDir = path.join(__dirname, 'www', 'logs');
  const logFilePath = path.join(logDir, `review_${logDate}.txt`);

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Format the log entry
  const logEntry = `UserID: ${userID} | UserName: ${userName} | LocationID: ${locationID} | Action: ${action} | Timestamp: ${timestamp}\n`;

  // Append the log entry to the file
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error("File logging error: ", err);
      return res.status(500).json({ message: "File logging error" });
    }

    // Respond with success message
    return res.status(201).json({
      message: "Enrollment review action logged successfully",
      log: {
        userID,
        locationID,
        action,
        timestamp
      }
    });
  });
});

/**********************************************************************/
/********************* LOG LOCATION ENROLLMENT REVIEW *****************/
/**********************************************************************/
httpWebApp.post('/api/user/updateProfile', (req, res) => {
  const { id, name, email, phone } = req.body; // Extract user data from the request body

  // Validate required fields
  if (!id || !name || !email || !phone) {
    return res.status(400).json({ message: "All fields (userID, name, email, phone) are required" });
  }

  // SQL query to update the user's profile
  const query = `
    UPDATE user
    SET name = ?, email = ?, phoneno = ?
    WHERE id = ?
  `;

  // Parameters for the query
  const params = [name, email, phone, id];

  // Execute the query
  db.query(query, params, (err, result) => {
    if (err) {
      console.error("Database error: ", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Check if any rows were affected (updated)
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Respond with a success message
    return res.status(200).json({ message: "Profile updated successfully" });
  });
});



/**********************************************************************/
/****************** SERVE INDEX.HTML FROM SUBDIRECTORIES **************/
/**********************************************************************/
// Serve index.html from subdirectories automatically
httpWebApp.get('*', (req, res) => {
  const filePath = path.resolve(__dirname, `www${req.url}/index.html`);

  // Check if the index.html file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (!err) {
      // If it exists, send the index.html file
      res.sendFile(filePath);
    } else {
      // If it doesn't exist, send a 404 error
      res.status(404).send('404 Not Found');
    }
  });
});

// Serve PHP files from the www directory
httpWebApp.use("/", epf(options));

const PORT = process.env.PORT || 3000;
// Start the server
httpWebApp.listen(PORT, '0.0.0.0', () => {
  console.log('SkyRealm Admin Panel is running in HTTP mode using port ' + PORT)
});

handleDisconnect();