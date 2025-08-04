// server/routes/paymentRoutes.js
// Этот файл определяет API-маршруты для создания платежей через ЮKassa.

const express = require('express');
const { YooKassa } = require('@yookassa/sdk'); // Официальный SDK от ЮKassa
const { Order, OrderItem, ProductVariant, sequelize } = require('../models');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid'); // Для генерации уникального ключа идемпотентности

const router = express.Router();

// --- 1. Инициализация клиента ЮKassa ---
// ВАЖНО: В реальном проекте shopId и секретный ключ должны храниться 
// в переменных окружения (.env) и никогда не должны быть в коде.
const yooKassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID || 'YOUR_SHOP_ID',
  secretKey: process.env.YOOKASSA_SECRET_KEY || 'YOUR_SECRET_KEY'
});

// --- 2. Маршрут для создания платежа ---
// POST /api/checkout/create-payment
router.post('/checkout/create-payment', isAuthenticated, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { cart } = req.session;
    const userId = req.user.id;

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }

    // Шаг 2.1: Создаем заказ в нашей базе со статусом "Ожидает оплаты"
    const order = await Order.create({
      UserId: userId,
      totalAmount: cart.total,
      status: 'Ожидает оплаты'
    }, { transaction: t });
    
    // Создаем позиции заказа
    for (const item of cart.items) {
      await OrderItem.create({
        OrderId: order.id,
        ProductVariantId: item.variantId,
        quantity: item.quantity,
        price: item.price
      }, { transaction: t });
    }

    // Шаг 2.2: Создаем платеж в ЮKassa
    const idempotenceKey = uuidv4(); // Уникальный ключ для каждого запроса
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
        return_url: `http://localhost:3000/order-confirmation.html?orderId=${order.id}` // URL, куда вернется пользователь
      },
      description: `Заказ №${order.id}`,
      metadata: {
        orderId: order.id // Передаем наш внутренний ID заказа
      }
    }, idempotenceKey);

    // Сохраняем ID платежа из ЮKassa в нашем заказе
    order.paymentId = payment.id;
    await order.save({ transaction: t });

    await t.commit(); // Подтверждаем транзакцию

    // Очищаем корзину
    req.session.cart = { items: [], total: 0 };

    // Шаг 3: Отправляем ссылку для оплаты на фронтенд
    res.json({ confirmationUrl: payment.confirmation.confirmation_url });

  } catch (error) {
    await t.rollback();
    console.error('Ошибка при создании платежа:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// --- 3. Маршрут для приема Webhook-уведомлений от ЮKassa ---
// POST /api/payments/webhook
router.post('/payments/webhook', async (req, res) => {
    try {
        const notification = req.body;
        
        if (notification.event === 'payment.succeeded' && notification.object.status === 'succeeded') {
            const paymentId = notification.object.id;
            const orderId = notification.object.metadata.orderId;

            const order = await Order.findOne({ where: { id: orderId, paymentId: paymentId } });

            if (order && order.status === 'Ожидает оплаты') {
                // Шаг 6: Обновляем статус заказа на "В обработке"
                order.status = 'В обработке';
                await order.save();
                
                // Здесь можно запустить логику уменьшения остатков на складе 
                // и отправки email-подтверждения пользователю.
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
