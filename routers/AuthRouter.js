const express = require("express");
const authController = require("../controllers/AuthController");
const auth = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/roles");

const router = express.Router();

router.get("/me", auth, authController.getMe);
router.get("/me-with-bookings", auth, authController.getMeWithBookings);
router.post("/login", authController.login);
router.post("/register", auth, requireAdmin, authController.register);
router.get("/verify", auth, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

module.exports = router;
