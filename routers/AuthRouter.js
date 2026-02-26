const express = require("express");
const authController = require("../controllers/AuthController");
const auth = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/roles");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);

module.exports = router;
