const pool = require("../config/db");
const { generateHashPassword } = require("../util/PasswordUtil");
const { isAdmin, isDataEmpty } = require("../util/helper");

const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      role,
      search,
      includeDeleted = false,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: "Page must be a positive integer" });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    const offset = (pageNum - 1) * limitNum;

    const whereConditions = [];
    const queryParams = [];
    let paramCounter = 1;

    if (role) {
      if (!["admin", "owner", "user"].includes(role)) {
        return res.status(400).json({
          error: "Invalid role. Must be admin, owner, or user",
        });
      }
      whereConditions.push(`role = $${paramCounter++}`);
      queryParams.push(role);
    }

    if (!includeDeleted) {
      whereConditions.push(`is_deleted = $${paramCounter++}`);
      queryParams.push(false);
    }

    if (search) {
      whereConditions.push(
        `(name ILIKE $${paramCounter++} OR email ILIKE $${paramCounter++})`,
      );
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause =
      whereConditions.length > 0
        ? "WHERE " + whereConditions.join(" AND ")
        : "";

    // VALIDATE SORT
    const validSortColumns = [
      "id",
      "name",
      "email",
      "role",
      "created_at",
      "is_deleted",
    ];
    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : "created_at";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const countQuery = `
      SELECT COUNT(*) 
      FROM users 
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        id,
        name,
        email,
        role,
        is_deleted,
        created_at
      FROM users 
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramCounter++} OFFSET $${paramCounter++}
    `;

    const dataParams = [...queryParams, limitNum, offset];

    const result = await pool.query(dataQuery, dataParams);

    const usersWithBookingCounts = await Promise.all(
      result.rows.map(async (user) => {
        const bookingCount = await pool.query(
          "SELECT COUNT(*) FROM bookings WHERE user_id = $1",
          [user.id],
        );

        return {
          ...user,
          totalBookings: parseInt(bookingCount.rows[0].count),
        };
      }),
    );

    // CALCULATE PAGINATION METADATA
    const totalPages = Math.ceil(totalUsers / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      success: true,
      data: usersWithBookingCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalUsers,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null,
      },
      filters: {
        role: role || null,
        search: search || null,
        includeDeleted: includeDeleted === "true",
      },
      sort: {
        by: sortColumn,
        order: order.toLowerCase(),
      },
    });
  } catch (err) {
    console.error("Error in getAllUsers:", {
      message: err.message,
      stack: err.stack,
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: "Server error while fetching users",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, role, email, is_deleted, created_at 
       FROM users 
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error in getUserById:", err.message);
    res.status(500).json({ error: "Server error while fetching user" });
  }
};

const createUser = async (req, res) => {
  const { name, role, email, password } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: "Name and role are required" });
  }

  if (!["admin", "owner", "user"].includes(role)) {
    return res
      .status(400)
      .json({ error: "Invalid role. Must be admin, owner, or user" });
  }
  const password_hash = await generateHashPassword(password);
  try {
    if (email) {
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND is_deleted = false",
        [email],
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    const result = await pool.query(
      `INSERT INTO users (name, role, email, password_hash) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, role, email, created_at`,
      [name, role, email || null, password_hash || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error in createUser:", err.message);
    res.status(500).json({ error: "Server error while creating user" });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND is_deleted = false",
      [id],
    );

    if (isDataEmpty(userCheck.rows)) {
      return res.status(404).json({ error: "User not found" });
    }

    if (role && !isAdmin(req.user.role)) {
      return res.status(403).json({ error: "Only admins can change roles" });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (role && isAdmin(req.user.role)) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(", ")} 
       WHERE id = $${paramCount} 
       RETURNING id, name, role, email, created_at`,
      values,
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error in updateUser:", err.message);
    res.status(500).json({ error: "Server error while updating user" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND is_deleted = false",
      [id],
    );

    if (isDataEmpty(userCheck.rows)) {
      return res
        .status(404)
        .json({ error: "User not found or already deleted" });
    }

    if (req.user.id === id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await pool.query("UPDATE users SET is_deleted = true WHERE id = $1", [id]);

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error in deleteUser:", err.message);
    res.status(500).json({ error: "Server error while deleting user" });
  }
};

const hardDeleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM bookings WHERE user_id = $1", [id]);
      const result = await client.query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [id],
      );

      if (isDataEmpty(result.rows)) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }
      await client.query("COMMIT");
      res.json({ message: "User permanently deleted" });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error in hardDeleteUser:", err.message);
    res
      .status(500)
      .json({ error: "Server error while permanently deleting user" });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  hardDeleteUser,
};
