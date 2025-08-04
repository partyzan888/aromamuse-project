// server/routes/orderRoutes.js
// Этот файл определяет API-маршруты для корзины и оформления заказов.

const express = require('express');
const { Order, OrderItem, ProductVariant, sequelize } = require('../models');
const { isAuthenticated } = require('../middleware/authMiddleware'); // Middleware для проверки аутентификации

const router = express.Router();

// --- 1. Логика работы с корзиной (через сессию) ---

// GET /api/cart - Получить содержимое корзины
router.get('/cart', (req, res) => {
  if (!req.session.cart) {
    // Если корзины в сессии нет, возвращаем пустую
    return res.json({ items: [], total: 0 });
  }
  res.json(req.session.cart);
});

// POST /api/cart - Добавить товар в корзину
router.post('/cart', async (req, res) => {
  try {
    const { variantId, quantity } = req.body;
    if (!variantId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Неверные данные для добавления в корзину' });
    }

    // Проверяем, существует ли такой вариант товара
    const variant = await ProductVariant.findByPk(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    
    // Инициализируем корзину в сессии, если ее нет
    if (!req.session.cart) {
      req.session.cart = { items: [], total: 0 };
    }
    
    const cart = req.session.cart;
    const existingItemIndex = cart.items.findIndex(item => item.variantId === variantId);

    if (existingItemIndex > -1) {
      // Если товар уже в корзине, обновляем количество
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Иначе добавляем новый товар
      const product = await variant.getProduct();
      cart.items.push({ 
        variantId: variant.id, 
        name: product.name,
        brand: product.brand,
        volume: variant.volume,
        price: variant.price,
        quantity: quantity 
      });
    }
    
    // Пересчитываем общую стоимость
    cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    res.status(200).json(cart);
  } catch (error) {
    console.error('Ошибка при добавлении в корзину:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// --- 2. Логика получения заказов пользователя ---

// GET /api/orders - Получить историю заказов для текущего пользователя
router.get('/orders', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const orders = await Order.findAll({
            where: { UserId: userId },
            order: [['createdAt', 'DESC']]
        });
        res.json(orders);
    } catch (error) {
        console.error('Ошибка при получении истории заказов:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});


module.exports = router;
