const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const authRouter = require("./routers/AuthRouter");
const userRouter = require("./routers/UserRouter");
const bookingRouter = require("./routers/BookingRouter");

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "Express PostgreSQL CRUD API" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/bookings", bookingRouter);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
