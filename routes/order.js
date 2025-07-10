const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/authMiddleware');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { requireAdmin } = require('../middleware/authMiddleware');

const nodemailer = require('nodemailer');

const generateFourDigitId = require('../models/Order').generateFourDigitId || async function generateFourDigitId() {
  let id;
  let isUnique = false;
  const maxRetries = 5;
  let retries = 0;
  while (!isUnique && retries < maxRetries) {
    id = Math.floor(1000 + Math.random() * 9000).toString();
    const existingOrder = await Order.findOne({ id });
    if (!existingOrder) {
      isUnique = true;
    }
    retries++;
  }
  if (!isUnique) {
    throw new Error('Failed to generate unique order ID');
  }
  return id;
};


router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      cartItems = [],
      billingDetails = {},
      shippingDetails = {},
      paymentMethod = 'cash-on-delivery',
      paymentStatus = 'pending',
      total = 0,
      shipping = 0,
      finalTotal = 0,
      stripePaymentId = '',
    } = req.body;

    if (!cartItems.length) {
      return res.status(400).json({ error: 'Cart items are required' });
    }
    if (!billingDetails.email && !billingDetails.phone) {
      return res.status(400).json({ error: 'Billing details (email or phone) are required' });
    }

    const id = await generateFourDigitId();
    const orderData = {
      id, // <-- set id manually
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
      totalUSD: req.body.totalUSD || 0,
      finalTotalPKR: req.body.finalTotalPKR || finalTotal,
      finalTotalUSD: req.body.totalUSD || 0,
      orderStatus: paymentMethod === 'credit-card' ? 'accepted' : 'pending',
    };
    const order = new Order(orderData);
    await order.save();

    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`Product ${item.productId} not found, skipping stock update`);
        continue;
      }
      if (item.color && Array.isArray(product.colors)) {
        const colorObj = product.colors.find(c => c.color === item.color);
        if (colorObj) {
          colorObj.stock = Math.max(0, (colorObj.stock || 0) - item.quantity);
        } else {
          console.warn(`Color ${item.color} not found for product ${item.productId}`);
        }
        product.stock = product.colors.reduce((sum, c) => sum + (c.stock || 0), 0);
      } else {
        product.stock = Math.max(0, (product.stock || 0) - item.quantity);
      }
      product.status = product.stock > 0 ? 'In Stock' : 'Out Of Stock';
      await product.save();
    }

    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { items: [] },
      { upsert: true, new: true }
    );

    res.status(201).json({ ...order.toObject(), _id: order._id.toString() });
  } catch (err) {
    console.error('Order Save Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ... (other routes remain unchanged)

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email');
    res.status(200).json(orders.map(order => {
      const obj = order.toObject();
      return { ...obj, _id: order._id.toString(), id: obj.id };
    }));
  } catch (err) {
    console.error('Order Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const sendOrderStatusEmail = async (to, orderId, statusLabel) => {
  if (!to) {
    console.warn('No email provided for order status update:', orderId);
    return;
  }
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



router.put('/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status, reason, cancelledBy } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: `Order with ID ${req.params.id} not found` });
    }

    const update = { orderStatus: status };
    if ((status === 'accepted' || status === 'delivered') && order.paymentMethod === 'cash-on-delivery') {
      update.paymentStatus = 'paid';
    }
    if (status === 'cancelled') {
      if (reason) update.cancellationReason = reason;
      if (cancelledBy) update.cancelledBy = cancelledBy;
    }

    const now = new Date();
    let statusUpdates = order.statusUpdates || [];
    statusUpdates.push({ status, date: now });
    update.statusUpdates = statusUpdates;

    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, update, { new: true });

    const statusMap = {
      pending: 'Order Received',
      accepted: 'Order Accepted',
      'out-for-delivery': 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      failed: 'Failed',
    };
    const userEmail = updatedOrder.billingDetails?.email;
    if (userEmail) {
      await sendOrderStatusEmail(userEmail, updatedOrder.id || updatedOrder._id, statusMap[status] || status);
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Status Update Error:', error);
    res.status(500).json({ message: 'Failed to update status', details: error.message });
  }
});


router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!req.user?._id || order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }
    if (order.orderStatus === 'cancelled' || order.orderStatus === 'delivered') {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    order.orderStatus = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by user';
    order.cancelledBy = 'user';
    order.statusUpdates = order.statusUpdates || [];
    order.statusUpdates.push({ status: 'cancelled', date: new Date() });

    await order.save();
    if (order.billingDetails?.email) {
      await sendOrderStatusEmail(order.billingDetails.email, order.id || order._id, 'Cancelled');
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

router.get('/user', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders.map(order => {
      const obj = order.toObject();
      return { ...obj, _id: order._id.toString(), id: obj.id };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/revenue', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

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

router.get('/product-order-counts', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const orderCounts = await Order.aggregate([
      { $unwind: "$cartItems" },
      { $group: {
          _id: "$cartItems.productId",
          orderCount: { $sum: "$cartItems.quantity" }
        }
      }
    ]);
    const orderCountMap = {};
    orderCounts.forEach(item => {
      orderCountMap[item._id?.toString()] = item.orderCount;
    });
    const products = await Product.find();
    const productsWithOrderCount = products.map(product => ({
      ...product.toObject(),
      orderCount: orderCountMap[product._id.toString()] || 0
    }));
    res.json(productsWithOrderCount);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product order counts' });
  }
});

module.exports = router;