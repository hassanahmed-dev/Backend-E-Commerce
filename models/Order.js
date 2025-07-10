const mongoose = require('mongoose');

async function generateFourDigitId() {
  let id;
  let isUnique = false;
  const maxRetries = 5;
  let retries = 0;

  while (!isUnique && retries < maxRetries) {
    id = Math.floor(1000 + Math.random() * 9000).toString();
    const existingOrder = await mongoose.model('Order').findOne({ id });
    if (!existingOrder) {
      isUnique = true;
    }
    retries++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique order ID');
  }
  return id;
}

const OrderSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: true
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  cartItems: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: String,
      image: String,
      color: String,
      size: String,
      price: Number,
      quantity: Number,
    }
  ],
  billingDetails: {
    firstName: String,
    lastName: String,
    country: String,
    address: String,
    apartment: String,
    city: String,
    state: String,
    postalCode: String,
    phone: String,
    email: String,
  },
  shippingDetails: {
    country: String,
    address: String,
    apartment: String,
    city: String,
    state: String,
  },
  paymentMethod: { type: String, enum: ['credit-card', 'cash-on-delivery'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  orderStatus: { type: String, enum: ['pending', 'accepted', 'out-for-delivery', 'delivered', 'cancelled', 'failed'], default: 'pending' },
  total: Number,
  shipping: Number,
  finalTotal: Number,
  stripePaymentId: String,
  totalPKR: Number,
  totalUSD: Number,
  finalTotalPKR: Number,
  finalTotalUSD: Number,
  cancellationReason: { type: String },
  cancelledBy: { type: String, enum: ['admin', 'user'] },
  createdAt: { type: Date, default: Date.now },
  statusUpdates: [
    {
      status: { type: String, enum: ['pending', 'accepted', 'out-for-delivery', 'delivered', 'cancelled', 'failed'] },
      date: { type: Date, default: Date.now }
    }
  ],
});

module.exports = mongoose.model('Order', OrderSchema);