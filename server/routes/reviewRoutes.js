// server/routes/reviewRoutes.js
// Этот файл определяет API-маршруты для работы с отзывами.

const express = require('express');
const { Review, User, Product } = require('../models'); // Импортируем нужные модели
const { isAuthenticated } = require('../middleware/authMiddleware'); // Middleware для проверки аутентификации

const router = express.Router();

// --- 1. Маршрут для получения всех отзывов для конкретного товара ---
// GET /api/products/:productId/reviews
router.get('/products/:productId/reviews', async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.findAll({
      where: { ProductId: productId },
      include: {
        model: User,
        attributes: ['firstName'] // Включаем только имя пользователя, чтобы не светить лишние данные
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(reviews);

  } catch (error)
    {
    console.error('Ошибка при получении отзывов:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});


// --- 2. Маршрут для создания нового отзыва ---
// POST /api/products/:productId/reviews
// Защищаем маршрут: только аутентифицированные пользователи могут оставлять отзывы
router.post('/products/:productId/reviews', isAuthenticated, async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id; // Получаем ID пользователя из сессии

    // Проверяем, существует ли товар
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    
    // В реальном приложении стоило бы проверить, покупал ли пользователь этот товар.
    // Мы опустим эту проверку для упрощения.

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Рейтинг должен быть от 1 до 5' });
    }

    const newReview = await Review.create({
      rating,
      comment,
      ProductId: productId,
      UserId: userId
    });
    
    // Возвращаем новый отзыв вместе с информацией о пользователе
    const reviewWithUser = await Review.findByPk(newReview.id, {
        include: { model: User, attributes: ['firstName'] }
    });

    res.status(201).json(reviewWithUser);

  } catch (error) {
    console.error('Ошибка при создании отзыва:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
