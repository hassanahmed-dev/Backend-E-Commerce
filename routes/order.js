const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { requireAdmin } = require('../middleware/authMiddleware');

const nodemailer = require('nodemailer');

// Create a new order (login required)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      cartItems,
      billingDetails,
      shippingDetails,
      paymentMethod,
      paymentStatus,
      total,
      shipping,
      finalTotal,
      stripePaymentId,
    } = req.body;
    const orderData = {
      cartItems,
      billingDetails,
      shippingDetails,
      paymentMethod,
      paymentStatus,
      total,
      shipping,
      finalTotal,
      stripePaymentId,
      user: req.user._id,
      userName: req.user.name,
      totalPKR: req.body.totalPKR || total,
      totalUSD: req.body.totalUSD,
      finalTotalPKR: req.body.finalTotalPKR || finalTotal,
      finalTotalUSD: req.body.finalTotalUSD,
      orderStatus: paymentMethod === 'credit-card' ? 'accepted' : 'pending',
    };
    const order = new Order(orderData);
    await order.save();

    // Update product stock after order
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (product) {
        // If color variant is specified, update color-wise stock
        if (item.color && Array.isArray(product.colors)) {
          const colorObj = product.colors.find(c => c.color === item.color);
          if (colorObj) {
            colorObj.stock = Math.max(0, colorObj.stock - item.quantity);
          }
          // Update main product stock as sum of all color stocks
          product.stock = product.colors.reduce((sum, c) => sum + (c.stock || 0), 0);
        } else {
          // Fallback: update main product stock
          product.stock = Math.max(0, product.stock - item.quantity);
        }
        product.status = product.stock > 0 ? 'In Stock' : 'Out Of Stock';
        await product.save();
      }
    }

    // Clear user's cart after successful order
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { items: [] }
    );

    res.status(201).json(order);
  } catch (err) {
    console.error('Order Save Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all orders (admin or for order management)
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email');
    res.status(200).json(orders);
  } catch (err) {
    console.error('Order Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Email utility
const sendOrderStatusEmail = async (to, orderId, statusLabel) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Order #${orderId} Status Update`,
    html: `<p>Your order <b>#${orderId}</b> status is now: <b>${statusLabel}</b>.</p>`
  });
};

// Update order status (now updates orderStatus field and sends email)
router.put('/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status, reason, cancelledBy } = req.body;
    const update = { orderStatus: status };
    if (status === 'cancelled') {
      if (reason) update.cancellationReason = reason;
      if (cancelledBy) update.cancelledBy = cancelledBy;
    }
    const order = await Order.findOneAndUpdate(
      { id: req.params.id },
      update,
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // Send email to user
    const statusMap = {
      pending: 'Order Received',
      accepted: 'Order Accepted',
      'out-for-delivery': 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      failed: 'Failed',
    };
    const userEmail = order.billingDetails?.email;
    if (userEmail) {
      await sendOrderStatusEmail(userEmail, order.id, statusMap[status] || status);
    }
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});


router.get('/user', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue by day for current week
router.get('/revenue', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Get start of week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (dayOfWeek + 6) % 7; // days since Monday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Aggregate revenue per day for this week
    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          value: { $sum: "$finalTotal" }
        }
      }
    ]);

    // Map MongoDB day numbers to day names
    const dayMap = { 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const revenueData = weekDays.map(day => ({
      day,
      value: revenue.find(r => dayMap[r._id] === day)?.value || 0
    }));

    res.json(revenueData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard summary endpoint
router.get('/summary', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalSalesAgg = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$finalTotal" } } }
    ]);
    const totalProducts = await Product.countDocuments();
    const totalRevenue = totalSalesAgg[0]?.total || 0;

    res.json({
      totalOrders,
      totalSales: totalRevenue,
      totalProducts,
      totalRevenue
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 