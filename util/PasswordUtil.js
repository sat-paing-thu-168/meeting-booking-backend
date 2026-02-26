const bcrypt = require("bcrypt");
require("dotenv").config();

exports.generateHashPassword = async (password) => {
  const salt = await bcrypt.genSalt(Number(process.env.BCRYPT_SALE_ROUNDS));
  const hashPassword = await bcrypt.hash(password, salt);
  return hashPassword;
};

exports.validPassword = async (password, hashPassword) => {
  return await bcrypt.compare(password, hashPassword);
};
