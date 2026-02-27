const pool = require("../config/db");
const { isAdminOrOwner, isUser } = require("../util/helper");

const UNIQUE_VIOLATION_CODE = "23505";
const CHECK_VIOLATION_CODE = "23514";

exports.getAllBookings = async (req, res) => {
  try {
    const { startDate, endDate, userId, limit = 50, offset = 0 } = req.query;

    let query = `
  SELECT 
    b.id, 
    b.start_time, 
    b.end_time, 
    b.created_at,
    b.user_id,
    u.name as user_name,
    u.role as user_role
  FROM bookings b
  JOIN users u ON b.user_id = u.id
  WHERE 1=1
    AND u.is_deleted = false
`;

    const values = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND b.start_time >= $${paramCount++}`;
      values.push(startDate);
    }

    if (endDate) {
      query += ` AND b.end_time <= $${paramCount++}`;
      values.push(endDate);
    }

    if (userId) {
      query += ` AND b.user_id = $${paramCount++}`;
      values.push(userId);
    }

    // Add pagination
    query += ` ORDER BY b.start_time DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count for pagination
    const countResult = await pool.query("SELECT COUNT(*) FROM bookings");
    const total = parseInt(countResult.rows[0].count);

    res.json({
      total,
      bookings: result.rows.map((booking) => ({
        id: booking.id,
        userId: booking.user_id,
        userName: booking.user_name,
        userRole: booking.user_role,
        startTime: booking.start_time,
        endTime: booking.end_time,
        createdAt: booking.created_at,
        durationMinutes:
          (new Date(booking.end_time) - new Date(booking.start_time)) /
          (1000 * 60),
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total,
        remaining: Math.max(0, total - (parseInt(offset) + parseInt(limit))),
      },
    });
  } catch (err) {
    console.error("Error in getAllBookings:", err);
    res.status(500).json({ error: "Server error fetching bookings" });
  }
};

exports.getBasicUsageSummary = async (req, res) => {
  try {
    const { period = "all" } = req.query;

    let dateFilter = "";
    if (period === "week") {
      dateFilter = "AND b.created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === "month") {
      dateFilter = "AND b.created_at >= NOW() - INTERVAL '30 days'";
    } else if (period === "year") {
      dateFilter = "AND b.created_at >= NOW() - INTERVAL '365 days'";
    }

    const result = await pool.query(`
      SELECT 
        u.id as "userId",
        u.name as "userName",
        u.email as "userEmail",
        u.role as "userRole",
        COUNT(b.id) as "totalBookings",
        SUM(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 60)::integer as "totalMinutes"
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id
      WHERE u.is_deleted = false
      ${dateFilter}
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY "totalBookings" DESC
    `);

    const totalBookings = result.rows.reduce(
      (sum, user) => sum + parseInt(user.totalBookings),
      0,
    );
    const activeUsers = result.rows.filter((u) => u.totalBookings > 0).length;

    res.json({
      success: true,
      summary: {
        period,
        totalBookings,
        activeUsers,
        users: result.rows.map((user) => ({
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          userRole: user.userRole,
          totalBookings: parseInt(user.totalBookings),
          totalMinutes: user.totalMinutes || 0,
          totalHours: user.totalMinutes
            ? (user.totalMinutes / 60).toFixed(1)
            : 0,
        })),
      },
    });
  } catch (err) {
    console.error("Error in getBasicUsageSummary:", err.message);
    res.status(500).json({
      success: false,
      error: "Server error while generating usage summary",
    });
  }
};

exports.getBookingsGroupedByUser = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.role as user_role,
        u.email as user_email,
        json_agg(
          json_build_object(
            'id', b.id,
            'startTime', b.start_time,
            'endTime', b.end_time,
            'createdAt', b.created_at,
            'durationMinutes', EXTRACT(EPOCH FROM (b.end_time - b.start_time))/60
          ) ORDER BY b.start_time
        ) as bookings
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id
      WHERE u.is_deleted = false
    `;

    const values = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND b.start_time >= $${paramCount++}`;
      values.push(startDate);
    }

    if (endDate) {
      query += ` AND b.start_time <= $${paramCount++}`;
      values.push(endDate);
    }

    query += ` GROUP BY u.id, u.name, u.role, u.email ORDER BY u.name`;

    const result = await pool.query(query, values);

    const groupedData = result.rows.map((user) => ({
      userId: user.user_id,
      userName: user.user_name,
      userRole: user.user_role,
      userEmail: user.user_email,
      totalBookings: user.bookings[0]?.id ? user.bookings.length : 0,
      bookings: user.bookings[0]?.id ? user.bookings : [],
    }));

    res.json({
      totalUsers: groupedData.length,
      usersWithBookings: groupedData.filter((u) => u.totalBookings > 0).length,
      data: groupedData,
    });
  } catch (err) {
    console.error("Error in getBookingsGroupedByUser:", err.message);
    res.status(500).json({ error: "Server error fetching grouped bookings" });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    const userId = req.user.id;

    // VALIDATION STEP 1: Input presence
    if (!startTime || !endTime) {
      return res.status(400).json({
        error: "Validation failed",
        details: {
          startTime: !startTime ? "Start time is required" : null,
          endTime: !endTime ? "End time is required" : null,
        },
      });
    }

    // VALIDATION STEP 2: Parse and validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: "Validation failed",
        details:
          'Invalid date format. Use ISO 8601 (e.g., "2025-03-15T10:00:00Z")',
      });
    }

    // VALIDATION STEP 3: startTime < endTime
    if (start >= end) {
      return res.status(400).json({
        error: "Validation failed",
        details: "Start time must be before end time",
      });
    }

    // VALIDATION STEP 4: Check for minimum duration
    const durationMinutes = (end - start) / (1000 * 60);
    if (durationMinutes < 15) {
      return res.status(400).json({
        error: "Validation failed",
        details: "Booking must be at least 15 minutes long",
      });
    }

    // VALIDATION STEP 5: Check for maximum duration
    if (durationMinutes > 24 * 60) {
      // 24 hours
      return res.status(400).json({
        error: "Validation failed",
        details: "Booking cannot exceed 24 hours",
      });
    }

    // OVERLAP DETECTION - The main logic
    // Using a single query to check for ANY overlapping bookings
    // The condition: existing.start_time < new.end AND existing.end_time > new.start
    // This catches ALL overlap types EXCEPT back-to-back

    const overlapCheck = await pool.query(
      `SELECT id, start_time, end_time, user_id 
       FROM bookings 
       WHERE          
         start_time < $2          
         AND end_time > $1
       ORDER BY start_time`,
      [start, end],
    );

    // If any overlapping bookings exist
    if (overlapCheck.rows.length > 0) {
      // Format the conflicting bookings for a helpful error message
      const conflicts = overlapCheck.rows.map((booking) => ({
        id: booking.id,
        start: booking.start_time,
        end: booking.end_time,
        bookedBy: booking.user_id === userId ? "you" : "another user",
      }));

      // Determine the type of overlap for more specific error message
      let overlapType = "overlaps with";

      // Check if it's an exact match (identical times)
      const exactMatch = overlapCheck.rows.find(
        (b) =>
          b.start_time.getTime() === start.getTime() &&
          b.end_time.getTime() === end.getTime(),
      );

      if (exactMatch) {
        overlapType = "exactly matches";
      } else {
        // Check if new booking is completely inside an existing one
        const insideExisting = overlapCheck.rows.find(
          (b) => b.start_time <= start && b.end_time >= end,
        );
        if (insideExisting) overlapType = "is within";

        // Check if existing booking is completely inside new one
        const existingInside = overlapCheck.rows.find(
          (b) => start <= b.start_time && end >= b.end_time,
        );
        if (existingInside) overlapType = "contains";
      }

      return res.status(409).json({
        error: "Booking conflict",
        details: `Your booking ${overlapType} existing booking(s)`,
        conflicts: conflicts.map((c) => ({
          ...c,
          start: c.start.toISOString(),
          end: c.end.toISOString(),
        })),
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO bookings (user_id, start_time, end_time) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id, start_time, end_time, created_at`,
        [userId, start, end],
      );

      await client.query("COMMIT");

      console.log(
        `Booking created: User ${userId} booked from ${start.toISOString()} to ${end.toISOString()}`,
      );

      // Return the created booking with formatted dates
      const booking = result.rows[0];

      res.status(201).json({
        message: "Booking created successfully",
        booking: {
          id: booking.id,
          userId: booking.user_id,
          startTime: booking.start_time.toISOString(),
          endTime: booking.end_time.toISOString(),
          createdAt: booking.created_at.toISOString(),
          durationMinutes:
            (booking.end_time - booking.start_time) / (1000 * 60),
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error in createBooking:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
      body: req.body,
    });

    // Check for specific database errors
    if (err.code === UNIQUE_VIOLATION_CODE) {
      return res.status(409).json({
        error: "Duplicate booking",
        details: "This booking conflicts with an existing booking",
      });
    }

    if (err.code === CHECK_VIOLATION_CODE) {
      return res.status(400).json({
        error: "Validation failed",
        details: "Booking violates database constraints",
      });
    }

    res.status(500).json({
      error: "Server error",
      details: "Unable to create booking. Please try again later.",
    });
  }
};

exports.deleteBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const bookingResult = await client.query(
        `SELECT b.*, u.name as owner_name 
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         WHERE b.id = $1`,
        [id],
      );

      if (bookingResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Booking not found" });
      }

      const booking = bookingResult.rows[0];

      if (isAdminOrOwner(userRole)) {
        await client.query("DELETE FROM bookings WHERE id = $1", [id]);
      } else if (isUser(userRole) && booking.user_id === userId) {
        await client.query("DELETE FROM bookings WHERE id = $1", [id]);
      } else {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Access denied",
          details: "You can only delete your own bookings",
        });
      }

      await client.query("COMMIT");

      res.json({
        message: "Booking deleted successfully",
        deletedBooking: {
          id: booking.id,
          startTime: booking.start_time,
          endTime: booking.end_time,
          owner: booking.owner_name,
          deletedBy: req.user.name || "Unknown",
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error in deleteBooking:", err.message);
    res.status(500).json({ error: "Server error deleting booking" });
  }
};
