// routes/mainRoutes.js
const express = require('express');
const router = express.Router();
const { loadSchema } = require('../validators/schemaLoader');

const validate = loadSchema('validation.json');

// Home route
router.get('/', (req, res) => {
  res.send('<h2>Welcome to Demo 1 Assignment (JavaScript Version)</h2>');
});

// Health route
router.get('/health', (req, res) => {
  res.json({ status: 'UP', message: 'Server running fine' });
});

// Validate route
router.post('/validate', express.json(), (req, res) => {
  const valid = validate(req.body);

  if (valid) {
    return res.json({ valid: true, message: 'Valid JSON structure' });
  }

  res.status(400).json({ valid: false, errors: validate.errors });
});

module.exports = router;
