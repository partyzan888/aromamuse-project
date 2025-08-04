// server/middleware/authMiddleware.js

const isAuthenticated = (req, res, next) => {
  // Проверяем, есть ли информация о пользователе в сессии
  if (req.session && req.session.user) {
    // Если пользователь аутентифицирован, передаем управление следующему middleware
    // Также мы можем прикрепить данные пользователя к объекту запроса для удобства
    req.user = req.session.user;
    return next();
  }
  
  // Если пользователь не аутентифицирован, отправляем ошибку 401
  res.status(401).json({ message: 'Пользователь не аутентифицирован. Пожалуйста, войдите в систему.' });
};

module.exports = { isAuthenticated };
