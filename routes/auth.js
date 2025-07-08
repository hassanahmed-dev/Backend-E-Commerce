// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const bcrypt = require('bcryptjs');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const jwt = require('jsonwebtoken');
// const verifyToken = require('../middleware/authMiddleware');
// const { requireAdmin } = require('../middleware/authMiddleware');

// const transporter = nodemailer.createTransport({
//   service: 'gmail', // Use your email service (e.g., Gmail, Outlook)
//   auth: {
//     user: process.env.EMAIL_USER, // Add to .env
//     pass: process.env.EMAIL_PASS, // Add to .env (App Password if 2FA enabled)
//   },
// });

// // Signup
// router.post('/signup', async (req, res) => {
//   const { name, email, phone, password } = req.body;

//   try {
//     if (!name || !email || !phone || !password) {
//       return res.status(400).json({ message: 'All fields are required' });
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'Email already exists' });
//     }

//     const phoneRegex = /^[0-9]{10,15}$/;
//     if (!phoneRegex.test(phone)) {
//       return res.status(400).json({ message: 'Invalid phone number' });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

//     const user = new User({
//       name,
//       email,
//       phone,
//       password: hashedPassword,
//       verificationCode: verificationCode,
//       verificationCodeExpiry: Date.now() + 3600000, // 1 hour expiry
//     });

//     await user.save();

//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Verify Your Email',
//       html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
//     });

//     res.status(201).json({ message: 'User registered. Please check your email for the verification code.' });
//   } catch (error) {
//     console.error('Signup error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Verify Email
// router.post('/verify', async (req, res) => {
//   const { token } = req.body;

//   try {
//     const user = await User.findOne({ verificationCode: token, verificationCodeExpiry: { $gt: Date.now() } });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired verification code' });
//     }

//     user.isVerified = true;
//     user.verificationCode = undefined;
//     user.verificationCodeExpiry = undefined;
//     await user.save();

//     res.json({ message: 'Email verified successfully' });
//   } catch (error) {
//     res.status(500).json({ message: 'Verification failed' });
//   }
// });

// // Signin
// router.post('/signin', async (req, res) => {
//   const { username, password } = req.body;

//   try {
//     const user = await User.findOne({ $or: [{ email: username }, { name: username }] });
//     if (!user || !user.isVerified) {
//       return res.status(400).json({ message: 'Invalid credentials or unverified email' });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     const token = jwt.sign(
//       { id: user._id, name: user.name, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     res.json({
//       message: 'Login successful',
//       userId: user._id,
//       userName: user.name,
//       token
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Forgot Password
// router.post('/forgot-password', async (req, res) => {
//   const { email } = req.body;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'Email not found' });
//     }

//     const resetToken = crypto.randomBytes(20).toString('hex');
//     user.resetToken = resetToken;
//     user.resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
//     await user.save();

//     const resetLink = `${process.env.FRONTEND_URL}/createnewpassword?token=${resetToken}`;
//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Password Reset Request',
//       html: `<p>Click the link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
//     });

//     res.json({ message: 'Password reset link sent to your email' });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Reset Password
// router.post('/reset-password', async (req, res) => {
//   const { token, password } = req.body;

//   try {
//     const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired token' });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     user.password = hashedPassword;
//     user.resetToken = undefined;
//     user.resetTokenExpiry = undefined;
//     await user.save();

//     res.json({ message: 'Password reset successful' });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Get User Profile
// router.get('/profile/:id', async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json(user);
//   } catch (error) {
//     console.error('Profile fetch error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Update user profile (name, phone)
// router.put('/profile/:id', async (req, res) => {
//   const { name, phone } = req.body;
//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     if (name) user.name = name;
//     if (phone) user.phone = phone;
//     await user.save();
//     res.json({ message: 'Profile updated', user });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Change password (verify current password, hash new password)
// router.put('/change-password/:id', async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   try {
//     const user = await User.findById(req.params.id);
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
//     const salt = await bcrypt.genSalt(10);
//     user.password = await bcrypt.hash(newPassword, salt);
//     await user.save();
//     res.json({ message: 'Password updated successfully' });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // PUT /api/auth/profile/:id - Full replace user profile
// router.put('/profile/:id', async (req, res) => {
//   try {
//     // req.body should contain the full user object (name, phone, email, etc.)
//     const updatedUser = await User.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, overwrite: true }
//     );
//     if (!updatedUser) return res.status(404).json({ message: 'User not found' });
//     res.json({ message: 'Profile fully replaced', user: updatedUser });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');
const cors = require('cors'); // Import cors

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Enable CORS with specific options
router.use(cors({
  origin: 'https://frontend-e-commerce-ruby.vercel.app/', // Allow your frontend origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // Explicitly allow PATCH
  credentials: true, // Allow cookies/auth headers if needed
}));

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      verificationCode: verificationCode,
      verificationCodeExpiry: Date.now() + 3600000,
    });

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email',
      html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
    });

    res.status(201).json({ message: 'User registered. Please check your email for the verification code.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify Email
router.post('/verify', async (req, res) => {
  const { token } = req.body;

  try {
    const user = await User.findOne({ verificationCode: token, verificationCodeExpiry: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed' });
  }
});

// Signin
router.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ $or: [{ email: username }, { name: username }] });
    if (!user || !user.isVerified) {
      return res.status(400).json({ message: 'Invalid credentials or unverified email' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      userId: user._id,
      userName: user.name,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/createnewpassword?token=${resetToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click the link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`,
    });

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  try {
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Profile
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile (name, phone)
router.put('/profile/:id', verifyToken, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) {
      const phoneRegex = /^[0-9]{10,15}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number' });
      }
      user.phone = phone;
    }

    await user.save();
    res.json({ message: 'Profile updated', user: user.toObject({ getters: true }) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.patch('/change-password/:id', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;