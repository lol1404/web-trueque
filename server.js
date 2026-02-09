const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'tu_super_secreto_jwt'; // ¡Cambia esto en producción!

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No hay token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token inválido
        req.user = user;
        next();
    });
};

// --- ENDPOINTS DE API ---

// 1. Autenticación
app.post('/api/register', async (req, res) => {
    const { name, email, password, location } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (name, email, password, location) VALUES (?,?,?,?)';
        db.run(sql, [name, email, hashedPassword, location], function(err) {
            if (err) {
                return res.status(409).json({ error: 'El email ya está en uso.' });
            }
            res.status(201).json({ message: 'Usuario registrado con éxito.', userId: this.lastID });
        });
    } catch {
        res.status(500).send();
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Email o contraseña incorrectos.' });
        }
        try {
            if (await bcrypt.compare(password, user.password)) {
                const accessToken = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
                res.json({ accessToken: accessToken });
            } else {
                res.status(400).json({ error: 'Email o contraseña incorrectos.' });
            }
        } catch {
            res.status(500).send();
        }
    });
});

// 2. Rutas de Usuario (protegidas)
app.get('/api/user/me', authenticateToken, (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.location, u.tokens, u.level, u.insignias,
        (SELECT COUNT(*) FROM trades WHERE user1_id = u.id OR user2_id = u.id) as trade_count
        FROM users u WHERE u.id = ?
    `;
    db.get(sql, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.sendStatus(404);
        res.json(user);
    });
});


// 3. Rutas de Productos
app.get('/api/products', (req, res) => {
    let sql = `SELECT p.*, u.name as owner_name, u.location as owner_location FROM products p 
               JOIN users u ON p.owner_id = u.id 
               WHERE p.status = 'available'`;
    const params = [];
    if (req.query.category) {
        sql += ' AND p.category = ?';
        params.push(req.query.category);
    }
     if (req.query.max_value) {
        sql += ' AND p.value <= ?';
        params.push(req.query.max_value);
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/products', authenticateToken, (req, res) => {
    const { name, description, value, category, image_url } = req.body;
    // Lógica simple para calcular valor/categoría si no se proveen
    const finalValue = value || (description.length % 20) + 10;
    const finalCategory = category || ['Servicios', 'Hogar', 'Tecnología'][finalValue % 3];

    const sql = 'INSERT INTO products (owner_id, name, description, value, category, image_url) VALUES (?,?,?,?,?,?)';
    db.run(sql, [req.user.id, name, description, finalValue, finalCategory, image_url], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Producto añadido', productId: this.lastID });
    });
});

// 4. Ruta de Trueques
app.post('/api/trades/complete', authenticateToken, (req, res) => {
    const { myProductId, theirProductId } = req.body;
    const myUserId = req.user.id;

    db.get('SELECT * FROM products WHERE id = ? AND owner_id = ?', [myProductId, myUserId], (err, myProduct) => {
        db.get('SELECT * FROM products WHERE id = ?', [theirProductId], (err, theirProduct) => {
            if (!myProduct || !theirProduct) {
                return res.status(404).json({ error: 'Uno o ambos productos no existen.' });
            }
            if (myProduct.status !== 'available' || theirProduct.status !== 'available') {
                return res.status(409).json({ error: 'Uno de los productos ya no está disponible.' });
            }

            const valueDiff = myProduct.value - theirProduct.value;
            // Limitar especulación: diferencia de valor no puede ser > 20% del producto más caro
            const maxVal = Math.max(myProduct.value, theirProduct.value);
            if (Math.abs(valueDiff) > maxVal * 0.20) {
                 return res.status(400).json({ error: `La diferencia de valor es muy grande. Máximo 20% (${maxVal*0.20} créditos). Intenta agrupar productos.` });
            }
            
            const theirUserId = theirProduct.owner_id;

            // Registrar el trueque en estado "pending"
            const tradeSql = `INSERT INTO trades (user1_id, user2_id, product1_id, product2_id, status, token_transfer) VALUES (?, ?, ?, ?, ?, ?)`;
            db.run(tradeSql, [myUserId, theirUserId, myProductId, theirProductId, 'pending', valueDiff], function(err) {
                if (err) {
                    return res.status(500).json({ error: "Error al crear la solicitud de trueque." });
                }
                res.status(200).json({ message: '¡Solicitud de trueque enviada! Esperando respuesta...', tradeId: this.lastID });
            });
        });
    });
});

// 5. Rutas de mis Trueques
app.get('/api/my-trades', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT t.*, 
               p1.name as my_product_name, p1.image_url as my_product_image,
               p2.name as their_product_name, p2.image_url as their_product_image,
               u1.name as user1_name, u2.name as user2_name
        FROM trades t
        LEFT JOIN products p1 ON t.product1_id = p1.id
        LEFT JOIN products p2 ON t.product2_id = p2.id
        LEFT JOIN users u1 ON t.user1_id = u1.id
        LEFT JOIN users u2 ON t.user2_id = u2.id
        WHERE t.user1_id = ? OR t.user2_id = ?
        ORDER BY t.timestamp DESC
    `;
    db.all(sql, [userId, userId], (err, trades) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(trades);
    });
});

app.put('/api/trades/:id', authenticateToken, (req, res) => {
    const tradeId = req.params.id;
    const userId = req.user.id;
    const { status } = req.body;

    if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Estado de trueque inválido.' });
    }

    // Obtener la solicitud de trueque
    db.get('SELECT * FROM trades WHERE id = ?', [tradeId], (err, trade) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!trade) return res.status(404).json({ error: 'Trueque no encontrado.' });

        // Solo user2 (quien recibe) puede aceptar o rechazar
        if (userId !== trade.user2_id) {
            return res.status(403).json({ error: 'Solo el otro usuario puede aceptar o rechazar el trueque.' });
        }

        // Si rechaza, solo cambiar estado
        if (status === 'cancelled') {
            db.run('UPDATE trades SET status = ? WHERE id = ?', ['cancelled', tradeId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: '¡Trueque rechazado!' });
            });
            return;
        }

        // Si acepta (status === 'completed'), realizar la transferencia
        if (status === 'completed') {
            // Obtener datos de los productos
            db.get('SELECT * FROM products WHERE id = ?', [trade.product1_id], (err, product1) => {
                db.get('SELECT * FROM products WHERE id = ?', [trade.product2_id], (err, product2) => {
                    
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        
                        // Actualizar dueños y estado de productos
                        db.run('UPDATE products SET status = "traded", owner_id = ? WHERE id = ?', [trade.user2_id, trade.product1_id]);
                        db.run('UPDATE products SET status = "traded", owner_id = ? WHERE id = ?', [trade.user1_id, trade.product2_id]);
                        
                        // Transferir tokens si hay diferencia
                        if (trade.token_transfer !== 0) {
                            db.run('UPDATE users SET tokens = tokens - ? WHERE id = ?', [trade.token_transfer, trade.user1_id]);
                            db.run('UPDATE users SET tokens = tokens + ? WHERE id = ?', [trade.token_transfer, trade.user2_id]);
                        }
                        
                        // Cambiar estado a completed
                        db.run('UPDATE trades SET status = ? WHERE id = ?', ['completed', tradeId], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: "Error al completar el trueque." });
                            }
                            db.run('COMMIT');
                            res.json({ message: '¡Trueque aceptado! Intercambio completado.' });
                        });
                    });
                });
            });
        }
    });
});

// 6. Rutas de Campañas
app.get('/api/campaigns', (req, res) => {
    // Info estática, podría venir de la DB en una implementación más compleja
    res.json({
        bioalverde: {
            name: "Donación a BIOAlverde",
            description: "Colabora con este proyecto de inserción sociolaboral de Cáritas Sevilla. Tu donación en Truecréditos apoya la agricultura ecológica y la inclusión social en Montequinto. Recibirás una insignia especial."
        },
        plantaArbol: {
            name: "Campaña 'Planta un Árbol'",
            description: "Usa tus Truecréditos para apoyar la reforestación 'Sembrando Futuro en la Dehesa' en Dos Hermanas. Contribuye a la biodiversidad local y a la lucha contra el cambio climático."
        }
    });
});

app.post('/api/donate', authenticateToken, (req, res) => {
    const { campaign, amount } = req.body;
    const userId = req.user.id;
    const donationAmount = parseInt(amount, 10);

    if (donationAmount <= 0) return res.status(400).json({ error: 'La donación debe ser positiva.'});

    db.get('SELECT tokens FROM users WHERE id = ?', [userId], (err, user) => {
        if (user.tokens < donationAmount) {
            return res.status(400).json({ error: 'No tienes suficientes Truecréditos.'});
        }
        
        let insignia = null;
        if (campaign === 'bioalverde') insignia = 'bio-colaborador';
        if (campaign === 'tree') insignia = 'eco-heroe';

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('UPDATE users SET tokens = tokens - ? WHERE id = ?', [donationAmount, userId]);
            db.run('INSERT INTO campaign_donations (user_id, campaign_name, amount) VALUES (?,?,?)', [userId, campaign, donationAmount]);
            
            if (insignia) {
                 db.run(`UPDATE users SET insignias = json_insert(insignias, '$[#]', '${insignia}') WHERE id = ? AND NOT EXISTS (SELECT 1 FROM json_each(insignias) WHERE value = '${insignia}')`, [userId]);
            }
            
            db.run('COMMIT', (err) => {
                 if (err) return res.status(500).json({ error: 'Error procesando la donación.' });
                 res.json({ message: '¡Gracias por tu donación!' });
            });
        });
    });
});


// Fallback para cualquier otra ruta (sirve el frontend)
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});


app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
