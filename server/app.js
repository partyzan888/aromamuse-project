const express = require('express');
const session = require('express-session');
const path = require('path');

// Импорт маршрутов
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Для парсинга JSON-тел запросов
app.use(express.static(path.join(__dirname, '../public'))); // Отдавать статические файлы из папки public

// Настройка сессий
app.use(session({
  secret: 'a-very-secret-key-for-aroma-muse', // В продакшене ключ должен быть сложным и храниться в .env
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // В продакшене должно быть true для HTTPS
}));

// Подключаем маршруты
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', authRoutes);
app.use('/api', paymentRoutes);
app.use('/api', reviewRoutes);
app.use('/api', adminRoutes);

// Запускаем сервер после синхронизации с БД
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}).catch(err => {
    console.error('Не удалось синхронизировать базу данных:', err);
});
