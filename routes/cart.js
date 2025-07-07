const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const verifyToken = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// Get current user's cart
router.get('/', verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    res.json(cart || { userId: req.user._id, items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item to cart
router.post('/', verifyToken, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) cart = new Cart({ userId: req.user._id, items: [] });

    const existingItem = cart.items.find(item => item.productId === productId && item.size === size && item.color === color);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, name: product.productName, image: product.imageUrl, price: product.price, size, color, quantity });
    }
    await cart.save();

    res.json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update item quantity
router.put('/update', verifyToken, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    const item = cart.items.find(item => item.productId.toString() === productId && item.size === size && item.color === color);
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const diff = quantity - item.quantity;
    if (product.stock < diff) return res.status(400).json({ error: 'Not enough stock' });
    item.quantity = quantity;
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove item from cart
router.delete('/remove', verifyToken, async (req, res) => {
  try {
    const { productId, size, color } = req.body;
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId && item.size === size && item.color === color);
    if (itemIndex === -1) return res.status(404).json({ error: 'Item not found in cart' });
    const item = cart.items[itemIndex];
    cart.items.splice(itemIndex, 1);
    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 