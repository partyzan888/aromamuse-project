// server/routes/authRoutes.js
// Этот файл определяет API-маршруты для регистрации, входа и выхода пользователей.

const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models'); // Импортируем нашу модель User

const router = express.Router();
const SALT_ROUNDS = 10; // "Стоимость" хэширования пароля

// --- 1. Маршрут для регистрации нового пользователя ---
// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Простая валидация
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    // Проверяем, не занят ли email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    // Хэшируем пароль
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Создаем пользователя в базе данных
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      passwordHash
    });
    
    // Не отправляем хэш пароля обратно
    const userResponse = { id: newUser.id, firstName: newUser.firstName, email: newUser.email };

    res.status(201).json({ message: 'Пользователь успешно зарегистрирован', user: userResponse });

  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// --- 2. Маршрут для входа пользователя (аутентификации) ---
// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Необходимо указать email и пароль' });
    }

    // Ищем пользователя по email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Неверные учетные данные' }); // Используем общую ошибку
    }

    // Сравниваем предоставленный пароль с хэшем в базе
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    // Сохраняем информацию о пользователе в сессию
    req.session.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName
    };
    
    res.status(200).json({ message: 'Вход выполнен успешно', user: req.session.user });

  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

// --- 3. Маршрут для выхода пользователя ---
// POST /api/auth/logout
router.post('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Не удалось выполнить выход' });
    }
    res.clearCookie('connect.sid'); // Очищаем cookie сессии
    res.status(200).json({ message: 'Выход выполнен успешно' });
  });
});

// --- 4. Маршрут для проверки текущей сессии ---
// GET /api/auth/me
router.get('/auth/me', (req, res) => {
    if (req.session.user) {
        // Если пользователь в сессии, возвращаем его данные
        res.status(200).json(req.session.user);
    } else {
        // Если нет, возвращаем null или ошибку 401
        res.status(401).json({ message: 'Пользователь не аутентифицирован' });
    }
});


module.exports = router;
