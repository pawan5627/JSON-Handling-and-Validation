// app.js
const express = require('express');
const { port, appName } = require('./config/serverConfig');
const mainRoutes = require('./routes/mainRoutes');

const app = express();

// Mount routes
app.use('/', mainRoutes);

// Start server
app.listen(port, () => {
  console.log(`${appName} started on port ${port}`);
});
