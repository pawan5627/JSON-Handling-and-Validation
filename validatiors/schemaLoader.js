// validators/schemaLoader.js
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

function loadSchema(schemaFile = 'validation.json') {
  const filePath = path.resolve(process.cwd(), schemaFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema file not found at ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const schema = JSON.parse(raw);

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  return validate;
}

module.exports = { loadSchema };
