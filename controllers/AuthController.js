const pool = require("../config/db");
const { validPassword, generateHashPassword } = require("../util/PasswordUtil");
const { generateToken } = require("../util/JWTUtil");
const { isDataEmpty } = require("../util/helper");

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, password_hash, created_at 
       FROM users 
       WHERE email = $1 AND is_deleted = false`,
      [email],
    );

    if (isDataEmpty(result.rows)) {
      return res
        .status(400)
        .json({ message: "Email or password does not match." });
    }

    const user = result.rows[0];

    const isValid = await validPassword(password, user.password_hash);
    if (!isValid) {
      return res
        .status(400)
        .json({ message: "Email or password does not match." });
    }

    const token = generateToken(user);

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error during login" });
  }
};

const register = async (req, res) => {
  const { name, email, password, role = "user" } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });
  }

  try {
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND is_deleted = false",
      [email],
    );

    if (!isDataEmpty(emailCheck.rows)) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await generateHashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, email, role, password_hash) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role, created_at`,
      [name, email, role, passwordHash],
    );

    const newUser = result.rows[0];

    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: newUser,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
};

module.exports = {
  login,
  register,
};
