const crypto = require('crypto');

/**
 * Generates a random secure 6-digit numeric OTP.
 * @returns {string} Verification OTP code
 */
const generateVerificationToken = () => {
  return crypto.randomInt(100000, 999999).toString();
};

module.exports = {
  generateVerificationToken
};
