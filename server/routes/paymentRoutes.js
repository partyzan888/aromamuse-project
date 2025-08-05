// server/routes/paymentRoutes.js
// Этот файл определяет API-маршруты для создания платежей через ЮKassa.

const express = require('express');
const { YooKassa } = require('@yookassa/sdk'); // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ ИМПОРТ
const { Order, OrderItem, ProductVariant, sequelize } = require('../models');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid'); // Для генерации уникального ключа идемпотентности

const router = express.Router();

// --- 1. Инициализация клиента ЮKassa ---
const yooKassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID || 'YOUR_SHOP_ID',
  secretKey: process.env.YOOKASSA_SECRET_KEY || 'YOUR_SECRET_KEY'
});

// --- 2. Маршрут для создания платежа ---
router.post('/checkout/create-payment', isAuthenticated, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { cart } = req.session;
    const userId = req.user.id;

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }

    const order = await Order.create({
      UserId: userId,
      totalAmount: cart.total,
      status: 'Ожидает оплаты'
    }, { transaction: t });
    
    for (const item of cart.items) {
      await OrderItem.create({
        OrderId: order.id,
        ProductVariantId: item.variantId,
        quantity: item.quantity,
        price: item.price
      }, { transaction: t });
    }

    const idempotenceKey = uuidv4();
    const payment = await yooKassa.createPayment({
      amount: {
        value: order.totalAmount,
        currency: 'RUB'
      },
      payment_method_data: {
        type: 'bank_card'
      },
      confirmation: {
        type: 'redirect',
        return_url: `http://localhost:3000/order-confirmation.html?orderId=${order.id}`
      },
      description: `Заказ №${order.id}`,
      metadata: {
        orderId: order.id
      }
    }, idempotenceKey);

    order.paymentId = payment.id;
    await order.save({ transaction: t });

    await t.commit();

    req.session.cart = { items: [], total: 0 };

    res.json({ confirmationUrl: payment.confirmation.confirmation_url });

  } catch (error) {
    await t.rollback();
    console.error('Ошибка при создании платежа:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// --- 3. Маршрут для приема Webhook-уведомлений от ЮKassa ---
router.post('/payments/webhook', async (req, res) => {
    try {
        const notification = req.body;
        
        if (notification.event === 'payment.succeeded' && notification.object.status === 'succeeded') {
            const paymentId = notification.object.id;
            const orderId = notification.object.metadata.orderId;

            const order = await Order.findOne({ where: { id: orderId, paymentId: paymentId } });

            if (order && order.status === 'Ожидает оплаты') {
                order.status = 'В обработке';
                await order.save();
                console.log(`Заказ №${orderId} успешно оплачен.`);
            }
        }
        
        res.status(200).send();

    } catch (error) {
        console.error('Ошибка при обработке webhook:', error);
        res.status(500).send();
    }
});


module.exports = router;
