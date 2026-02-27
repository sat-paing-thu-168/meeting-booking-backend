const express = require("express");
const userController = require("../controllers/UserController");
const auth = require("../middlewares/auth");
const { requireAdmin, requireSelfOrAdmin } = require("../middlewares/roles");

const router = express.Router();

router.delete(
  "/:id/hard-delete",
  auth,
  requireAdmin,
  userController.hardDeleteUser,
);
router.patch("/:id/restore", auth, requireAdmin, userController.restoreUser);
router.delete("/:id", auth, requireAdmin, userController.deleteUser);
router.get("/:id", auth, requireSelfOrAdmin, userController.getUserById);
router.post("/create", auth, requireAdmin, userController.createUser);
router.put("/:id", auth, requireAdmin, userController.updateUser);
router.get("/", auth, requireAdmin, userController.getAllUsers);

module.exports = router;
