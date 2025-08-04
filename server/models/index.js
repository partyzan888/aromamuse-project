// server/models/index.js
// Этот файл настраивает соединение с базой данных и определяет все модели.

const { Sequelize, DataTypes } = require('sequelize');

// --- 1. Настройка соединения с базой данных ---
// В реальном проекте эти данные будут храниться в переменных окружения (.env)
const sequelize = new Sequelize('aroma_muse_db', 'user', 'password', {
  host: 'localhost',
  dialect: 'postgres'
});

// --- 2. Определение моделей ---

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true });

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  brand: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.ENUM('Женская', 'Мужская', 'Унисекс'), allowNull: false }
}, { timestamps: true });

const ProductVariant = sequelize.define('ProductVariant', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  volume: { type: DataTypes.STRING, allowNull: false }, // "100 мл", "10 мл", "2 мл"
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, { timestamps: false });

const Note = sequelize.define('Note', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true }
}, { timestamps: false });

const Review = sequelize.define('Review', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.TEXT }
}, { timestamps: true });

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  status: { type: DataTypes.ENUM('Ожидает оплаты', 'В обработке', 'В пути', 'Доставлен', 'Отменен'), defaultValue: 'Ожидает оплаты' },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paymentId: { type: DataTypes.STRING } // Для хранения ID платежа от ЮKassa
}, { timestamps: true });

const OrderItem = sequelize.define('OrderItem', {
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
});


// --- 3. Определение связей между моделями ---

Product.hasMany(ProductVariant, { as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product);

User.hasMany(Order, { as: 'orders' });
Order.belongsTo(User);

Order.hasMany(OrderItem, { as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order);

ProductVariant.hasMany(OrderItem);
OrderItem.belongsTo(ProductVariant);

Product.belongsToMany(Note, { through: 'ProductNotes' });
Note.belongsToMany(Product, { through: 'ProductNotes' });

Review.belongsTo(User);
Review.belongsTo(Product);
User.hasMany(Review);
Product.hasMany(Review);


// --- 4. Экспорт моделей ---
module.exports = {
  sequelize,
  User,
  Product,
  ProductVariant,
  Note,
  Review,
  Order,
  OrderItem
};
