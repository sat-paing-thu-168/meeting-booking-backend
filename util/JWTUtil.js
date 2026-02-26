const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );
};
