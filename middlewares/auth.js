const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = function (req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader)
    return res.status(401).json({ error: "Access denied. No token provided." });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    const decodedPayLoad = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedPayLoad;

    next();
  } catch (ex) {
    res.status(400).json({ error: "Invalid token." });
  }
};
