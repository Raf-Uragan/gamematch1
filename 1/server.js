const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'database', 'gamedb.db');

app.use(cors());
app.use(express.json());

if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, 'public')));
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
    }
});

// API: получить все жанры
app.get('/api/genres', (req, res) => {
    db.all('SELECT * FROM genres ORDER BY name_ru', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API: поиск игр
app.get('/api/games', (req, res) => {
    const { gpu, cpu, ram, genres } = req.query;
    
    let sql = `
        SELECT DISTINCT 
            g.*, 
            r.min_gpu, r.min_cpu, r.min_ram,
            r.recommended_gpu, r.recommended_cpu, r.recommended_ram
        FROM games g
        JOIN requirements r ON g.id = r.game_id
        LEFT JOIN game_genres gg ON g.id = gg.game_id
        WHERE 1=1
    `;
    
    const params = [];
    
    // Фильтр по ОЗУ
    if (ram) {
        sql += ` AND r.min_ram <= ?`;
        params.push(ram);
    }
    
    // Фильтр по жанрам
    if (genres && genres.length > 0) {
        const genreIds = genres.split(',').map(Number);
        const placeholders = genreIds.map(() => '?').join(',');
        sql += ` AND gg.genre_id IN (${placeholders})`;
        params.push(...genreIds);
    }
    
    sql += ` ORDER BY g.rating DESC LIMIT 50`;
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Ошибка запроса:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Добавляем совместимость для каждой игры
        const gamesWithCompat = rows.map(game => ({
            ...game,
            compatibility: calculateCompatibility(game, { gpu, cpu, ram: parseInt(ram) })
        }));
        
        res.json(gamesWithCompat);
    });
});

// Функция расчёта совместимости
function calculateCompatibility(game, userPC) {
    let score = 0;
    let reasons = [];
    
    // Проверка ОЗУ
    if (userPC.ram >= game.min_ram) {
        score += 40;
    } else {
        reasons.push(`Не хватает ОЗУ (нужно ${game.min_ram} ГБ)`);
    }
    
    // Оценка видеокарты
    const gpuLevel = getGPULevel(userPC.gpu);
    const requiredGPULevel = getGPULevel(game.min_gpu);
    
    if (gpuLevel >= requiredGPULevel) {
        score += 35;
    } else {
        reasons.push(`Видеокарта слабее (нужна ${game.min_gpu})`);
    }
    
    // Оценка процессора
    const cpuLevel = getCPULevel(userPC.cpu);
    const requiredCPULevel = getCPULevel(game.min_cpu);
    
    if (cpuLevel >= requiredCPULevel) {
        score += 25;
    } else {
        reasons.push(`Процессор слабее (нужен ${game.min_cpu})`);
    }
    
    let compatibility = 'bad';
    let compatibilityText = '❌ Не рекомендуется';
    let compatibilityColor = '#dc2626';
    
    if (score >= 80) {
        compatibility = 'good';
        compatibilityText = '✅ Отлично подходит';
        compatibilityColor = '#10b981';
    } else if (score >= 50) {
        compatibility = 'warning';
        compatibilityText = '⚠️ Средние настройки';
        compatibilityColor = '#f59e0b';
    }
    
    return {
        level: compatibility,
        text: compatibilityText,
        color: compatibilityColor,
        score: score,
        reasons: reasons
    };
}

function getGPULevel(gpuName) {
    if (!gpuName) return 0;
    const gpu = gpuName.toLowerCase();
    if (gpu.includes('rtx') || gpu.includes('rx 7') || gpu.includes('rx 6')) return 3;
    if (gpu.includes('gtx 10') || gpu.includes('gtx 16') || gpu.includes('1660')) return 2;
    if (gpu.includes('gtx 9') || gpu.includes('1050')) return 1;
    return 0;
}

function getCPULevel(cpuName) {
    if (!cpuName) return 0;
    const cpu = cpuName.toLowerCase();
    if (cpu.includes('i7') || cpu.includes('i9') || cpu.includes('ryzen 7') || cpu.includes('ryzen 9')) return 3;
    if (cpu.includes('i5') || cpu.includes('ryzen 5')) return 2;
    if (cpu.includes('i3') || cpu.includes('ryzen 3')) return 1;
    return 0;
}

module.exports = app;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    });
}