// server/routes/productRoutes.js
// Этот файл определяет API-маршруты для работы с товарами.

const express = require('express');
const { Op } = require('sequelize'); // Op (операторы) нужен для сложных запросов (например, 'like')
const { Product, ProductVariant, Note } = require('../models'); // Импортируем наши модели

const router = express.Router();

// --- 1. Маршрут для получения списка товаров (с фильтрацией и сортировкой) ---
// GET /api/products?category=Женская&notes=Роза,Ваниль&sortBy=price&order=ASC
router.get('/products', async (req, res) => {
  try {
    // -- Обработка фильтров из query параметров --
    const { category, brand, notes } = req.query;
    const whereClause = {}; // Объект для условий фильтрации товаров

    if (category) {
      whereClause.category = category;
    }
    if (brand) {
      // Можно передавать несколько брендов через запятую: brand=Byredo,Tom+Ford
      whereClause.brand = { [Op.in]: brand.split(',') };
    }

    // -- Обработка фильтра по нотам --
    let noteFilter = {};
    if (notes) {
      const notesArray = notes.split(',');
      noteFilter = {
        model: Note,
        where: { name: { [Op.in]: notesArray } },
        through: { attributes: [] } // Не включать данные из промежуточной таблицы
      };
    }

    // -- Обработка сортировки --
    const { sortBy = 'createdAt', order = 'DESC' } = req.query; // по умолчанию сортируем по дате создания
    const orderClause = [[sortBy, order]];

    // -- Запрос к базе данных --
    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: ProductVariant,
          as: 'variants', // Включаем варианты (объемы, цены)
        },
        noteFilter // Включаем фильтр по нотам, если он есть
      ],
      order: orderClause,
      distinct: true, // Важно, чтобы не было дубликатов из-за join с нотами
    });

    if (products.length === 0) {
      return res.status(404).json({ message: 'Товары по заданным критериям не найдены.' });
    }

    res.json(products);

  } catch (error) {
    console.error('Ошибка при получении товаров:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});


// --- 2. Маршрут для получения одного товара по ID ---
// GET /api/products/1
router.get('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findByPk(productId, {
            include: [
                { model: ProductVariant, as: 'variants' },
                { model: Note, through: { attributes: [] } } // Включаем все ноты товара
            ]
        });

        if (!product) {
            return res.status(404).json({ message: 'Товар не найден' });
        }

        res.json(product);

    } catch (error) {
        console.error(`Ошибка при получении товара ${req.params.id}:`, error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});


module.exports = router;
