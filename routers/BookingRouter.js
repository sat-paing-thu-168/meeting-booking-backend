const express = require("express");
const bookingController = require("../controllers/BookingController");
const auth = require("../middlewares/auth");
const { requireAdmin, requireAdminOrOwner } = require("../middlewares/roles");

const router = express.Router();

router.get(
  "/grouped-by-user",
  auth,
  requireAdminOrOwner,
  bookingController.getBookingsGroupedByUser,
);
router.get(
  "/usage-summary",
  auth,
  requireAdminOrOwner,
  bookingController.getBasicUsageSummary,
);
router.post("/create", auth, bookingController.createBooking);
router.delete("/:id", auth, bookingController.deleteBooking);
router.get("/", auth, bookingController.getAllBookings);

module.exports = router;
