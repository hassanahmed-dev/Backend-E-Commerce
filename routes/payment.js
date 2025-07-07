const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'pkr' } = req.body;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    let usdAmount = amount;
    let finalCurrency = 'usd';

    if (currency.toLowerCase() === 'pkr') {
      // Use exchangerate.host for real-time PKR to USD conversion
      const url = `https://v6.exchangerate-api.com/v6/eed80ec9f9cd2a751a400c0b/pair/USD/PKR`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(data)
      if (data.result !== 'success' || !data.conversion_rate) {
        return res.status(500).json({ error: 'Failed to fetch exchange rate' });
      }
      const usdRate = data.conversion_rate;
      usdAmount = amount / usdRate;
    }

    // Stripe expects amount in cents (integer)
    const amountInCents = Math.round(usdAmount * 100);
    if (amountInCents < 50) {
      // Stripe minimum charge is $0.50
      return res.status(400).json({ error: 'Amount too low for Stripe' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: finalCurrency,
      payment_method_types: ['card'],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 