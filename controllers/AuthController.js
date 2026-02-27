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

const getMe = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
         id, 
         name, 
         email, 
         role, 
         is_deleted,
         created_at
       FROM users 
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
        details: "Your user account no longer exists",
      });
    }

    const user = result.rows[0];

    // Check if user is soft-deleted
    if (user.is_deleted) {
      return res.status(403).json({
        error: "Account deactivated",
        details:
          "Your account has been deactivated. Please contact an administrator.",
      });
    }

    // Get additional stats (optional)
    const bookingsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_bookings,
         COUNT(CASE WHEN start_time > NOW() THEN 1 END) as upcoming_bookings
       FROM bookings 
       WHERE user_id = $1`,
      [userId],
    );

    const userStats = bookingsResult.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        stats: {
          totalBookings: parseInt(userStats.total_bookings),
          upcomingBookings: parseInt(userStats.upcoming_bookings),
        },
      },
    });
  } catch (err) {
    console.error("Error in getMe:", err.message);
    res.status(500).json({
      error: "Server error",
      details: "Failed to fetch user profile",
    });
  }
};

const getMeWithBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user info
    const userResult = await pool.query(
      `SELECT id, name, email, role, created_at 
       FROM users 
       WHERE id = $1 AND is_deleted = false`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's bookings (last 10)
    const bookingsResult = await pool.query(
      `SELECT 
         id, 
         start_time, 
         end_time, 
         created_at,
         EXTRACT(EPOCH FROM (end_time - start_time))/60 as duration_minutes
       FROM bookings 
       WHERE user_id = $1 
       ORDER BY start_time DESC 
       LIMIT 10`,
      [userId],
    );

    // Get booking counts
    const countsResult = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN start_time > NOW() THEN 1 END) as upcoming,
         COUNT(CASE WHEN start_time < NOW() THEN 1 END) as past
       FROM bookings 
       WHERE user_id = $1`,
      [userId],
    );

    res.json({
      success: true,
      user: userResult.rows[0],
      bookings: bookingsResult.rows.map((b) => ({
        id: b.id,
        startTime: b.start_time,
        endTime: b.end_time,
        createdAt: b.created_at,
        durationMinutes: Math.round(b.duration_minutes),
      })),
      stats: {
        totalBookings: parseInt(countsResult.rows[0].total),
        upcomingBookings: parseInt(countsResult.rows[0].upcoming),
        pastBookings: parseInt(countsResult.rows[0].past),
      },
    });
  } catch (err) {
    console.error("Error in getMeWithBookings:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  login,
  register,
  getMe,
  getMeWithBookings,
};
