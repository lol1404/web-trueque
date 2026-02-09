# 🔄 TRUEKIT - Plataforma de Trueques

Una aplicación web moderna para **intercambiar productos y servicios** en tu comunidad usando un sistema de **Truecréditos**.

## ✨ Características

- 🔐 **Autenticación segura** con JWT
- 📦 **Marketplace de productos** filtrable por categoría
- 🤝 **Sistema de trueques** con aceptación/rechazo
- 💰 **Truecréditos** como moneda virtual de intercambio
- 📊 **Dashboard personal** con estadísticas
- 🏆 **Sistema de insignias** por colaboración
- 📍 **Ubicación de usuarios** para trueques locales
- 🎁 **Campañas comunitarias** de donación

## 🚀 Inicio Rápido

### Requisitos
- Node.js 14+
- npm

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/lol1404/web-trueque.git
cd web-trueque

# Instalar dependencias
npm install

# Iniciar el servidor
node server.js
```

El servidor correrá en `http://localhost:3000`

## 📊 Estructura del Proyecto

```
web-trueque/
├── server.js           # Servidor Express
├── database.js         # Configuración SQLite
├── package.json        # Dependencias
├── public/
│   ├── index.html      # Frontend
│   ├── app.js          # Lógica JavaScript
│   ├── style.css       # Estilos
│   └── logo.svg        # Logo de la app
└── .gitignore
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/register` - Registrar nuevo usuario
- `POST /api/login` - Iniciar sesión

### Productos
- `GET /api/products` - Obtener productos disponibles
- `POST /api/products` - Crear nuevo producto (requiere auth)

### Trueques
- `GET /api/my-trades` - Ver mis trueques (requiere auth)
- `POST /api/trades/complete` - Proponer trueque (requiere auth)
- `PUT /api/trades/:id` - Aceptar/rechazar trueque (requiere auth)

### Campañas
- `GET /api/campaigns` - Obtener campañas disponibles
- `POST /api/donate` - Donar a campaña (requiere auth)

## 👥 Usuarios de Prueba

```
Email: ana@truekit.com
Contraseña: 123456

Email: carlos@truekit.com
Contraseña: 123456
```

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Base de Datos**: SQLite
- **Seguridad**: JWT, bcrypt
- **UI Components**: Font Awesome Icons

## 📝 Flujo de Trueque

1. Usuario A ve producto de Usuario B
2. Usuario A inicia una solicitud de trueque
3. Solicitud queda en estado **"pending"**
4. Usuario B recibe notificación en "Mis Trueques"
5. Usuario B **acepta o rechaza**
6. Si acepta → productos se intercambian automáticamente
7. Trueque se marca como **"completed"**

## 🎨 Colores Principales

- **Verde Primario**: #2E7D32 (Eco-friendly)
- **Azul Secundario**: #0288D1 (Confianza)
- **Beige Acentos**: #A1887F (Calidez)

## 📦 Dependencias

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "sqlite3": "^5.1.6"
}
```

## 🤝 Contribuir

Este es un proyecto en desarrollo. Siéntete libre de hacer fork y proponer cambios.

## 📄 Licencia

MIT

## 👨‍💻 Autor

Desarrollado con ❤️ para promover la economía circular y el consumo consciente.

---

**¿Tienes ideas o encuentras bugs?** Abre un issue en GitHub.
