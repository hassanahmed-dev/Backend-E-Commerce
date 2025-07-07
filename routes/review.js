const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const verifyToken = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const { requireAdmin } = require('../middleware/authMiddleware');

// Add a review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { productId, productName, rating, text, userName } = req.body;
    // Debug log to see what is missing
    console.log({ productId, productName, rating, text, userName });
    if (!productId || !productName || !rating || !text || !userName) {
      return res.status(400).json({ message: 'All fields are required.', debug: { productId, productName, rating, text, userName } });
    }
    // Only allow review if user has ordered this product (and paid)
    const userObjectId = req.user._id;
    // Find the product's ObjectId if productId is a custom string
    let productObjectId;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      productObjectId = mongoose.Types.ObjectId(productId);
    } else {
      // Try to find the product by custom id
      const productDoc = await Product.findOne({ id: productId });
      if (!productDoc) {
        return res.status(400).json({ message: 'Product not found for given productId.' });
      }
      productObjectId = productDoc._id;
    }
    // Check for orders containing this product (allow any order, not just paid)
    const hasOrdered = await Order.exists({
      user: userObjectId,
      'cartItems.productId': productObjectId
    });
    if (!hasOrdered) {
      return res.status(403).json({ message: 'You can only review products you have ordered.' });
    }
    // Only allow one review per user per product (by custom id or ObjectId)
    const existingReview = await Review.findOne({ productId, userId: userObjectId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product.' });
    }
    const review = new Review({
      productId,
      productName,
      userId: userObjectId,
      userName,
      rating,
      text
    });
    await review.save();

    // After saving the review
    const reviews = await Review.find({ productId });
    const reviewsCount = reviews.length;
    const ratings = reviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount;

    // Update the product
    let productUpdateResult = await Product.findOneAndUpdate(
      { id: productId },
      { reviewsCount, ratings }
    );
    // If not found by custom id, try by _id
    if (!productUpdateResult) {
      productUpdateResult = await Product.findOneAndUpdate(
        { _id: productId },
        { reviewsCount, ratings }
      );
    }

    res.status(201).json({ message: 'Review added successfully', review });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get reviews for a product
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
        return res.status(400).json({ message: 'Product ID is required.' });
    }

    // Restore the logic to handle cases where productId might be a string or an ObjectId.
    // This is necessary if the data in the database is not consistent.
    const query = mongoose.Types.ObjectId.isValid(productId)
      ? { $or: [{ productId: mongoose.Types.ObjectId(productId) }, { productId: productId }] }
      : { productId: productId };

    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    // Added detailed logging to help debug future issues.
    console.error(`Error fetching reviews for productId: ${req.params.productId}`, err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all reviews
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete a review by ID
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
