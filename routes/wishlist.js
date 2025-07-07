const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const verifyToken = require('../middleware/authMiddleware');

// Get user's wishlist
router.get('/', verifyToken, async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id });
  res.json(wishlist ? wishlist.products : []);
});

// Add product to wishlist
router.post('/add', verifyToken, async (req, res) => {
  const { productId } = req.body;
  let wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) wishlist = new Wishlist({ userId: req.user._id, products: [] });
  if (!wishlist.products.includes(productId)) wishlist.products.push(productId);
  await wishlist.save();
  res.json(wishlist.products);
});

// Remove product from wishlist
router.post('/remove', verifyToken, async (req, res) => {
  const { productId } = req.body;
  let wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (wishlist) {
    wishlist.products = wishlist.products.filter(id => id !== productId);
    await wishlist.save();
  }
  res.json(wishlist ? wishlist.products : []);
});

module.exports = router; 