// server/routes/adminRoutes.js
// Маршруты для административной панели.

const express = require('express');
const multer = require('multer'); // Middleware для обработки загрузки файлов
const csv = require('csv-parser');
const { Readable } = require('stream');
const { Product, ProductVariant, sequelize } = require('../models');
const { isAuthenticated } = require('../middleware/authMiddleware'); // (Предполагается, что у нас будет проверка на админа)

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Храним файл в памяти, а не на диске

// Функция для парсинга названия (мы ее уже использовали)
function parseProductName(rawName) {
    let brand = 'Unknown';
    let name = rawName.trim();
    let volume = '';
    const parts = rawName.split(':');
    if (parts.length > 1) {
        brand = parts[0].trim();
        name = parts.slice(1).join(':').trim();
    }
    const volumeMatch = name.match(/(\d+\s?ml)/i);
    if (volumeMatch) {
        volume = volumeMatch[0];
        name = name.replace(volumeMatch[0], '').trim();
    }
    return { brand, name, volume };
}

// POST /api/admin/upload-pricelist - маршрут для загрузки и обработки CSV
router.post('/admin/upload-pricelist', isAuthenticated, upload.single('pricelist'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Файл не был загружен.' });
    }

    const results = [];
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    bufferStream.pipe(csv({
        mapHeaders: ({ header, index }) => {
            if (index === 0) return 'rawName';
            if (index === 2) return 'bottlePrice';
            if (index === 4) return 'price5ml';
            if (index === 5) return 'price10ml';
            if (index === 6) return 'price15ml';
            return null;
        }
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
        for (const row of results) {
            if (!row.rawName) continue;
            const { brand, name, volume } = parseProductName(row.rawName);
            if (!name) continue;

            try {
                const [product, created] = await Product.findOrCreate({
                    where: { name, brand },
                    defaults: {
                        name,
                        brand,
                        description: `Описание для ${brand} ${name}`,
                        category: 'Унисекс'
                    }
                });

                if (created) {
                    createdCount++;
                } else {
                    updatedCount++;
                }

                // Обновляем или создаем варианты
                const variants = [
                    { vol: volume, price: row.bottlePrice },
                    { vol: '5 мл', price: row.price5ml },
                    { vol: '10 мл', price: row.price10ml },
                    { vol: '15 мл', price: row.price15ml }
                ];

                for (const variantData of variants) {
                    if (variantData.price && variantData.vol) {
                        await ProductVariant.upsert({ // upsert = update or insert
                            ProductId: product.id,
                            volume: variantData.vol,
                            price: parseFloat(variantData.price),
                            stock: 50 // Можно добавить логику для остатков
                        });
                    }
                }
            } catch (error) {
                console.error(`Ошибка при обработке строки: ${row.rawName}`, error);
                errorCount++;
            }
        }
        res.json({
            message: 'Обработка завершена.',
            created: createdCount,
            updated: updatedCount,
            errors: errorCount
        });
    });
});

module.exports = router;
