const fs = require('fs');
let code = fs.readFileSync('functions/index.js', 'utf8');

code += `\n\n// Import Users Management Module
const usersModule = require('./users');
exports.createUserManually = usersModule.createUserManually;
`;

fs.writeFileSync('functions/index.js', code);
