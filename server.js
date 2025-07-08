require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Allow your frontend origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Explicitly allow PATCH
    credentials: true, // Allow cookies/auth headers if needed
  })
);

// Manual CORS headers (for extra safety)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Baaki sab middleware/routes yahan se shuru ho
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

  app.get("/", (req, res) => {
    res.send("Server is running");
  })
// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/product"));
const reviewRoutes = require("./routes/review");
app.use("/api/reviews", reviewRoutes);
const cartRoutes = require("./routes/cart");
app.use("/api/cart", cartRoutes);
const wishlistRoutes = require("./routes/wishlist");
app.use("/api/wishlist", wishlistRoutes);
const paymentRoutes = require("./routes/payment");
app.use("/api/payment", paymentRoutes);
const orderRoutes = require("./routes/order");
app.use("/api/orders", orderRoutes);

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Error in Server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is runnig on ${PORT}`);
});
