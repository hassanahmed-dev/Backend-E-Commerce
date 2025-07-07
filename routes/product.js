const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const streamifier = require('streamifier');
const { requireAdmin } = require('../middleware/authMiddleware');

// GET all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top-rated products for dashboard (dynamic by ratings)
router.get('/top-rated', async (req, res) => {
  try {
    const products = await Product.find({}, {
      productName: 1,
      ratings: 1,
      status: 1,
      price: 1,
      imageUrl: 1
    })
      .sort({ ratings: -1 })
      .limit(10);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add new product with image
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    console.log('Received product add request');
    // Parse array fields if they are sent as JSON strings
    if (typeof req.body.colors === 'string') {
        req.body.colors = JSON.parse(req.body.colors);
    }
    if (typeof req.body.sizes === 'string') {
        req.body.sizes = JSON.parse(req.body.sizes);
    }
    if (typeof req.body.images === 'string') {
        req.body.images = JSON.parse(req.body.images);
    }

    // Generate sequential 4-digit id
    const lastProduct = await Product.findOne().sort({ id: -1 }).limit(1);
    let newId = lastProduct && !isNaN(Number(lastProduct.id)) ? (Number(lastProduct.id) + 1).toString() : "1000";
    if (newId.length < 4) newId = newId.padStart(4, "0");

    let imageUrl = '';
    if (req.file) {
      console.log('Uploading image to Cloudinary...');
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, { folder: 'products' });
      imageUrl = uploadResponse.secure_url;
      console.log('Image uploaded:', imageUrl);
    }

    const stock = Number(req.body.stock) || 0;
    const status = stock > 0 ? 'In Stock' : 'Out Of Stock';

    const productData = {
      ...req.body,
      status,
      id: newId,
      imageUrl
    };

    // Remove colorStock if present (fixes Cast to embedded failed error)
    if (productData.colorStock) {
      delete productData.colorStock;
    }

    console.log('Saving product:', productData);
    const product = new Product(productData);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error('Error in product add route:', err);
    res.status(500).json({ message: 'Image upload failed', error: err.message });
  }
});

// PUT update product with image
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    // Parse JSON fields if needed
    if (typeof req.body.colors === 'string') {
      req.body.colors = JSON.parse(req.body.colors);
    }
    if (typeof req.body.sizes === 'string') {
      req.body.sizes = JSON.parse(req.body.sizes);
    }
    if (typeof req.body.images === 'string') {
        req.body.images = JSON.parse(req.body.images);
    }
    // Parse colorStock if sent as a string (defensive fix)
    if (typeof req.body.colorStock === 'string') {
      try {
        req.body.colorStock = JSON.parse(req.body.colorStock);
      } catch (e) {
        req.body.colorStock = undefined;
      }
    }
    
    // Upload new image if exists
    let imageUrl;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'products',
      });
      imageUrl = uploadResponse.secure_url;
      console.log('req.file:', req.file);
      console.log('imageUrl:', imageUrl);
    }

    const stock = Number(req.body.stock) || 0;
    const status = stock > 0 ? 'In Stock' : 'Out Of Stock';
    
    // Update product with new image URL if uploaded
    const updateData = {
      ...req.body,
      status,
      ...(imageUrl && { imageUrl })
    };

    // Remove colorStock if present (fixes Cast to embedded failed error on edit)
    if (updateData.colorStock) {
      delete updateData.colorStock;
    }

    const product = await Product.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true }
    );
    
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE product
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
}

module.exports = router; 