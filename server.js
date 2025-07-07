require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL, // Frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow all methods
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/product'));
const reviewRoutes = require('./routes/review');
app.use('/api/reviews', reviewRoutes);
const cartRoutes = require('./routes/cart');
app.use('/api/cart', cartRoutes);
const wishlistRoutes = require('./routes/wishlist');
app.use('/api/wishlist', wishlistRoutes);
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);
const orderRoutes = require('./routes/order');
app.use('/api/orders', orderRoutes);

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error in Server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is runnig on ${PORT}`);
});