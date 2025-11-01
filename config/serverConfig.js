// config/serverConfig.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  appName: process.env.APP_NAME || 'Demo1',
};
