// Updated server.js to support Render + Hostinger MySQL + ENV

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Admin login endpoint
app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM admin_users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length > 0) return res.json({ success: true });
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  );
});

// Add trip plan
app.post('/api/trip-plans', upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : '';
  db.query(
    'INSERT INTO trip_plans (image_url, title, description) VALUES (?, ?, ?)',
    [image_url, title, description],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ success: true });
    }
  );
});

// Get trip plans
app.get('/api/trip-plans', (req, res) => {
  db.query('SELECT * FROM trip_plans', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Delete trip plan
app.delete('/api/trip-plans/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT image_url FROM trip_plans WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err });

    db.query('DELETE FROM trip_plans WHERE id = ?', [id], (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length > 0 && results[0].image_url) {
        const imagePath = path.join(__dirname, results[0].image_url.replace(/^\//, ""));
        fs.unlink(imagePath, err => {
          if (err) console.warn("Image file not deleted or not found:", imagePath);
        });
      }
      res.json({ success: true });
    });
  });
});

// Send email
app.post('/api/send-mail', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: "All fields required" });

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: '8f1779001@smtp-brevo.com',
      pass: 'p20s9AE5bGUWVX8q'
    }
  });

  try {
    await transporter.sendMail({
      from: 'Cheapest Trip <8f1779001@smtp-brevo.com>',
      to: 'cheapesttrip.in@gmail.com',
      subject: 'New Contact Form Message',
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Mail not sent", detail: err.message });
  }
});

// Final port listener
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
