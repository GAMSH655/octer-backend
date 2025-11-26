import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fetch from "node-fetch";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Initialize Paystack Payment
app.post("/api/paystack/initialize", async (req, res) => {
  const { email, amount, metadata } = req.body;

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount,
        metadata,
       callback_url: `${process.env.FRONTEND_URL}/payment-status`

      })
    });

    const data = await response.json();

    if (data.status && data.data) {
      return res.json(data);
    } else {
      return res.status(400).json({ status: false, message: "Failed to initialize payment" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});


app.get("/api/paystack/verify/:reference", async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const data = await response.json();

    if (data.status && data.data?.status === "success") {
      const metadata = data.data.metadata || {};
      const customerEmail = data.data.customer?.email || "";

      // Email to user
      await transporter.sendMail({
        from: `"Octer Foods" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: "Payment Successful ✅",
        text: `Hello ${metadata.name || ""},\n\nYour payment of ₦${(data.data.amount/100).toLocaleString()} was successful.\nDelivery Address: ${metadata.address || ""}\nPhone: ${metadata.phone || ""}\n\nThank you for your order!`,
      });

      // Email to company
      await transporter.sendMail({
        from: `"Octer Foods" <${process.env.EMAIL_USER}>`,
        to: process.env.COMPANY_EMAIL,
        subject: "New Order Received 🛒",
        text: `New order received!\n\nCustomer Name: ${metadata.name}\nEmail: ${customerEmail}\nPhone: ${metadata.phone}\nDelivery Address: ${metadata.address}\nAmount: ₦${(data.data.amount/100).toLocaleString()}\nReference: ${reference}\nCart Items:\n${JSON.stringify(metadata.cart || [], null, 2)}`,
      });

      return res.json({ status: true, data: data.data });
    } else {
      return res.status(400).json({ status: false, message: "Payment failed" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
