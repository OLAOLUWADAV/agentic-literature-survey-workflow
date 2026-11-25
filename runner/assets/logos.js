/**
 * School logos as embedded base64 data URLs.
 * LOGO1 = SQI College of ICT  |  LOGO2 = Caleb University
 */

const fs = require('fs');
const path = require('path');

function loadLogo(filename) {
  try {
    const buf = fs.readFileSync(path.join(__dirname, filename));
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch {
    return '';
  }
}

const LOGO1 = loadLogo('sqi-logo.png');
const LOGO2 = loadLogo('caleb-logo.png');

module.exports = { LOGO1, LOGO2 };
