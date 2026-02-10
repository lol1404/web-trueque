const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DB_SOURCE = "truekit.db";

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    } else {
        console.log('Conectado a la base de datos SQLite.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Crear tabla de usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            location TEXT,
            tokens INTEGER DEFAULT 10,
            level INTEGER DEFAULT 1,
            insignias TEXT DEFAULT '[]'
        )`, (err) => {
            if (err) console.error("Error creando tabla users:", err);
            else seedUsers();
        });

        // Crear tabla de productos
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            value INTEGER NOT NULL,
            category TEXT,
            status TEXT DEFAULT 'available',
            image_url TEXT,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creando tabla products:", err);
            else seedProducts();
        });

        // Crear tabla de trueques
        db.run(`CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_id INTEGER,
            user2_id INTEGER,
            product1_id INTEGER,
            product2_id INTEGER,
            status TEXT DEFAULT 'completed',
            token_transfer INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
             if (err) console.error("Error creando tabla trades:", err);
        });

        // Crear tabla de reseñas
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_id INTEGER,
            reviewer_id INTEGER,
            reviewed_id INTEGER,
            rating INTEGER,
            comment TEXT,
            FOREIGN KEY (trade_id) REFERENCES trades(id),
            FOREIGN KEY (reviewer_id) REFERENCES users(id),
            FOREIGN KEY (reviewed_id) REFERENCES users(id)
        )`, (err) => {
             if (err) console.error("Error creando tabla reviews:", err);
        });
        
        // Crear tabla de donaciones/campañas
         db.run(`CREATE TABLE IF NOT EXISTS campaign_donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            campaign_name TEXT,
            amount INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`,(err) => {
             if (err) console.error("Error creando tabla campaign_donations:", err);
        });
        
        // Crear tabla de chats
        db.run(`CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trade_id INTEGER,
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trade_id) REFERENCES trades(id),
            FOREIGN KEY (user1_id) REFERENCES users(id),
            FOREIGN KEY (user2_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creando tabla chats:", err);
        });

        // Crear tabla de mensajes
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creando tabla messages:", err);
        });
    });
}

async function seedUsers() {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('123456', saltRounds);
    
    const users = [
        { name: 'Ana', email: 'ana@truekit.com', pass: passwordHash, location: 'Montequinto' },
        { name: 'Carlos', email: 'carlos@truekit.com', pass: passwordHash, location: 'Dos Hermanas' }
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO users (name, email, password, location) VALUES (?, ?, ?, ?)");
    users.forEach(user => stmt.run(user.name, user.email, user.pass, user.location));
    stmt.finalize();
}

function seedProducts() {
    const products = [
        { owner_id: 1, name: 'Guitarra Acústica', description: 'Casi nueva, cuerdas recién cambiadas.', value: 80, category: 'Instrumentos', image_url: 'https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=500' },
        { owner_id: 1, name: 'Clase de Programación en Python', description: '1 hora de clase particular para principiantes.', value: 25, category: 'Servicios', image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500' },
        { owner_id: 2, name: 'Bicicleta de Montaña', description: 'Usada pero en buen estado, perfecta para paseos.', value: 100, category: 'Deporte', image_url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=500' },
        { owner_id: 2, name: 'Cesta de Verduras Ecológicas', description: 'Verduras de temporada de mi huerto.', value: 20, category: 'Alimentación', image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500' },
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO products (owner_id, name, description, value, category, image_url) VALUES (?, ?, ?, ?, ?, ?)");
    products.forEach(p => stmt.run(p.owner_id, p.name, p.description, p.value, p.category, p.image_url));
    stmt.finalize();
}

module.exports = db;
