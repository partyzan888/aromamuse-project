// import-script.js
// Скрипт для разового импорта данных из CSV-файла в базу данных.

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Product, ProductVariant, sequelize } = require('./server/models');

// Путь к вашему CSV-файлу
const csvFilePath = path.join(__dirname, 'прайс лист aromamuse.xlsx - Лист1.csv');

// Функция для парсинга сложной строки наименования
function parseProductName(rawName) {
    // Пример: "HFC: Dazzling Girls 75ml"
    let brand = 'Unknown';
    let name = rawName.trim();
    let volume = '';

    const parts = rawName.split(':');
    if (parts.length > 1) {
        brand = parts[0].trim();
        name = parts.slice(1).join(':').trim();
    }

    // Попробуем извлечь объем (например, "75ml" или "100 ml")
    const volumeMatch = name.match(/(\d+\s?ml)/i);
    if (volumeMatch) {
        volume = volumeMatch[0];
        // Убираем объем из названия
        name = name.replace(volumeMatch[0], '').trim();
    }

    return { brand, name, volume };
}


async function importData() {
    console.log('Начинаем импорт данных...');

    const results = [];
    fs.createReadStream(csvFilePath)
        .pipe(csv({
            // Указываем заголовки, чтобы было удобнее работать
            mapHeaders: ({ header, index }) => {
                if (index === 0) return 'rawName';
                if (index === 2) return 'bottlePrice';
                if (index === 4) return 'price5ml';
                if (index === 5) return 'price10ml';
                if (index === 6) return 'price15ml';
                return null; // Игнорируем остальные колонки
            }
        }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`CSV-файл успешно прочитан. Найдено ${results.length} строк.`);

            for (const row of results) {
                if (!row.rawName) continue; // Пропускаем пустые строки

                const { brand, name, volume } = parseProductName(row.rawName);
                
                if (!name) continue;

                try {
                    // Используем транзакцию для каждой строки, чтобы обеспечить целостность
                    await sequelize.transaction(async (t) => {
                        // Шаг 1: Найти или создать основной продукт
                        const [product] = await Product.findOrCreate({
                            where: { name, brand },
                            defaults: {
                                name,
                                brand,
                                description: `Описание для ${brand} ${name}`, // Заглушка
                                category: 'Унисекс' // Заглушка, можно будет поменять
                            },
                            transaction: t
                        });

                        // Шаг 2: Создать варианты товара (ProductVariant)
                        
                        // Флакон
                        if (row.bottlePrice && volume) {
                            await ProductVariant.create({
                                ProductId: product.id,
                                volume: volume,
                                price: parseFloat(row.bottlePrice),
                                stock: 10 // Заглушка
                            }, { transaction: t });
                        }
                        // Отливант 5 мл
                        if (row.price5ml) {
                            await ProductVariant.create({
                                ProductId: product.id,
                                volume: '5 мл',
                                price: parseFloat(row.price5ml),
                                stock: 50 // Заглушка
                            }, { transaction: t });
                        }
                        // Отливант 10 мл
                        if (row.price10ml) {
                            await ProductVariant.create({
                                ProductId: product.id,
                                volume: '10 мл',
                                price: parseFloat(row.price10ml),
                                stock: 50 // Заглушка
                            }, { transaction: t });
                        }
                        // Отливант 15 мл
                        if (row.price15ml) {
                            await ProductVariant.create({
                                ProductId: product.id,
                                volume: '15 мл',
                                price: parseFloat(row.price15ml),
                                stock: 50 // Заглушка
                            }, { transaction: t });
                        }
                    });
                    console.log(`[УСПЕХ] Товар "${brand} - ${name}" импортирован.`);
                } catch (error) {
                    console.error(`[ОШИБКА] при импорте строки "${row.rawName}":`, error.message);
                }
            }
            console.log('Импорт завершен.');
        });
}

importData();