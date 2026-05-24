# Cómo instalar el Sistema Restrepo Acosta como App nativa

El sistema ahora es una **PWA (Progressive Web App)** instalable en iPhone, Android, Windows y macOS — sin pasar por la App Store, sin descargar de Google Play.

---

## 📱 EN TU iPHONE

### Paso 1: abrir en Safari (importante: NO Chrome)
1. Abre **Safari** (el navegador nativo de Apple)
2. Ve a: **https://restrepoacosta.onrender.com**
3. Ingresa tu contraseña

### Paso 2: agregar a pantalla de inicio
1. Tap en el botón de **Compartir** (cuadrado con flecha hacia arriba — abajo centro)
2. Desliza hacia abajo en el menú de opciones
3. Tap en **"Agregar a pantalla de inicio"** (icono ➕)
4. Verás el preview con el logo RA en cuadro cream
5. Tap **"Agregar"** arriba a la derecha

### Resultado
- 📱 En tu home screen aparece el icono **"RA Sistema"** con el logo Restrepo Acosta
- Al abrirlo se ejecuta **sin barra de navegación de Safari** — pantalla completa, como una app nativa
- Funciona con tu lock screen, Face ID, modo offline (datos cacheados)
- Las notificaciones de la app aparecen como cualquier app del iPhone (con permisos)

---

## 🤖 EN ANDROID (Chrome)

1. Abre **Chrome** y ve a: https://restrepoacosta.onrender.com
2. Chrome detecta automáticamente que es PWA y muestra banner: **"Agregar Restrepo Acosta a la pantalla de inicio"**
3. Tap **"Instalar"** (o ☰ → "Instalar app")
4. La app se instala como una app nativa en tu launcher

---

## 💻 EN MAC / WINDOWS (Chrome / Edge / Safari)

1. Abre la URL en Chrome o Edge
2. En la barra de direcciones aparece un icono ➕ a la derecha
3. Click → "Instalar Restrepo Acosta"
4. La app se abre en su propia ventana sin tabs

---

## ¿Por qué PWA y no App Store nativa?

| Aspecto | App Store nativa | PWA |
|---------|------------------|-----|
| Costo desarrollo | $$$$ (separado para iOS y Android) | $ (un solo código) |
| Tiempo aprobación | 1-2 semanas | Inmediato |
| Actualizaciones | Usuario debe actualizar | Auto-update silencioso |
| Comisión Apple/Google | 15-30% | 0% |
| Instalación | App Store / Play Store | URL directa |
| Tu caso de uso | ❌ Overkill para uso interno | ✅ Perfecto |

Para un sistema interno usado por 3-10 personas (tú + equipo + socios), **PWA es la opción profesional óptima**.

---

## 🔄 ACTUALIZACIONES AUTOMÁTICAS

Cuando hago un deploy nuevo:
1. La próxima vez que abras la app, el service worker detecta la versión nueva
2. Descarga los cambios en segundo plano
3. Al cerrar y reabrir la app, ves la última versión

**No tienes que hacer nada.** No hay "Actualizar app" en la App Store.

---

## 📴 FUNCIONA OFFLINE (limitado)

Si no tienes internet:
- ✅ La app abre con la última versión cacheada
- ✅ Puedes navegar entre pantallas que ya visitaste
- ❌ No puedes hacer cambios (esos van al servidor)
- ❌ Los datos no se actualizan hasta que vuelva la conexión

Cuando vuelvas a tener internet, la app sincroniza automáticamente.

---

## 🔐 SEGURIDAD EN MÓVIL

- La app usa el mismo password que la versión web (`18418598`)
- En iPhone puedes habilitar **Face ID / Touch ID** para abrir Safari/Chrome — eso protege el acceso
- El service worker NO cachea datos sensibles (solo HTML/CSS/JS del shell)
- Todas las llamadas API van directas al servidor (no se cachean)

---

## ❌ SI NO FUNCIONA EL "AGREGAR A PANTALLA DE INICIO"

### iPhone
- Asegúrate de usar **Safari**, NO Chrome ni Firefox
- iOS solo permite PWAs desde Safari
- Si usas Chrome: tap ☰ → "Agregar a Pantalla principal"

### Otros tips
- Cierra y reabre Safari
- Verifica que la URL sea exactamente `https://restrepoacosta.onrender.com` (con HTTPS)
- iOS 16.4 o superior es ideal (algunas features mejores)

---

## 🎨 IDENTIDAD VISUAL DE LA APP

- **Nombre en pantalla:** RA Sistema
- **Icono:** Logo cuadrado Restrepo Acosta sobre fondo cream
- **Splash screen:** Cream con texto "RESTREPO ACOSTA · cargando…"
- **Status bar:** Translúcida sobre el teal corporativo
- **Theme:** Brand cream + teal + gold

---

## 📲 ATAJOS RÁPIDOS (Long-press del icono)

Si tu sistema operativo lo soporta, al mantener presionado el icono de la app verás:
- **Módulo Técnico** → abre directo en `/tech`
- **Módulo Financiero** → abre directo en `/finance`

---

**¿Dudas?** El sistema está deployado en https://restrepoacosta.onrender.com. Cualquier dispositivo con un navegador moderno puede instalarlo como app.
