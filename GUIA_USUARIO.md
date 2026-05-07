# Guía de Usuario — Construction PM (Lote 87)
### Sin código, sin técnicos — solo lo que necesitas saber

---

## ¿Cómo funciona tu sistema?

Tu aplicación tiene dos partes:
- **El servidor** — vive en Render.com, siempre encendido, guarda todos los datos
- **La pantalla** — lo que ves en el navegador cuando abres la URL

Para hacer cambios, siempre editas archivos en tu computador → los subes a GitHub → Render los despliega automáticamente.

---

## Accesos importantes

| Qué | Dónde |
|-----|-------|
| Tu aplicación | https://construction-pm.onrender.com |
| Tu código | https://github.com/JotaRes/construction-pm |
| Tu servidor | https://dashboard.render.com |
| Tu carpeta local | `/Users/juandavid/Desktop/CLAUDE/construction-pm` |

---

## Cambiar la URL (de construction-pm a restrepoacosta)

**Esto solo lo puedes hacer tú en Render — son 4 clics:**

1. Ve a https://dashboard.render.com
2. Haz clic en tu servicio **construction-pm**
3. Haz clic en **Settings** (arriba a la derecha)
4. En el campo **Name**, borra `construction-pm` y escribe `restrepoacosta`
5. Haz clic en **Save Changes**

Tu nueva URL será: **https://restrepoacosta.onrender.com**

> ⚠️ La URL vieja deja de funcionar inmediatamente. Avisa a tu equipo.

---

## Cómo pedirle a Claude que haga cambios

Abre Cowork (este programa) y simplemente dile qué quieres cambiar. Ejemplos:

- *"Agrega una nueva fase llamada Paisajismo con 3 ítems"*
- *"Cambia el nombre del proyecto a Lote 88"*
- *"El Draw 3 fue aprobado por $45,000 el 15 de mayo, actualízalo"*
- *"Quiero agregar un campo de notas a cada fase"*
- *"Cambia el color del logo a azul"*

Claude hará los cambios en los archivos, los subirá a GitHub, y Render los desplegará en ~3 minutos.

---

## Los 3 tipos de cambios más comunes

### 1. Cambiar datos del proyecto (draws, inspecciones, fases)
**Archivo:** `backend/prisma/seed.ts`

Este archivo tiene toda la información de Lote 87: draws, fases, ítems, inspecciones.

**Importante:** los cambios en seed.ts solo afectan una **instalación nueva** (si se borra y recrea la base de datos). Para cambiar datos en producción sin borrar todo, necesitas usar la aplicación directamente o pedirle a Claude que cree un script de actualización.

### 2. Cambiar la interfaz visual (pantallas, colores, textos)
**Carpeta:** `frontend/src/`

Después de cualquier cambio visual, hay que **reconstruir el frontend**. Dile a Claude: *"reconstruye el frontend y súbelo"* — él lo hace todo.

### 3. Cambiar la lógica del servidor (cálculos, reglas de negocio)
**Carpeta:** `backend/src/`

Cambios más técnicos. Claude puede hacerlos si le describes qué comportamiento quieres.

---

## Flujo de trabajo estándar

```
Tú le dices a Claude qué cambiar
        ↓
Claude edita los archivos en tu carpeta
        ↓
Claude sube los cambios a GitHub (git push)
        ↓
Render detecta el cambio automáticamente
        ↓
En ~3-5 minutos tu app está actualizada
```

---

## ¿Qué hacer si la app no carga?

1. Ve a https://dashboard.render.com
2. Haz clic en tu servicio
3. Ve a **Logs** (pestaña)
4. Busca líneas en rojo — cópialas y díselas a Claude
5. Claude diagnostica y arregla

Si el servidor está "sleeping" (plan gratuito se duerme después de 15 min de inactividad), la primera carga tarda ~30 segundos — es normal.

---

## ¿Cómo agregar a tu equipo?

La aplicación usa una contraseña única para entrar. La contraseña actual es la que configuraste. Para cambiarla, dile a Claude: *"cambia la contraseña de acceso a [nueva contraseña]"*.

No hay usuarios individuales — todos entran con la misma contraseña. Si necesitas usuarios separados con permisos distintos, díselo a Claude y él diseña esa funcionalidad.

---

## Respaldo de tus datos

La base de datos vive en el servidor de Render. **Si el servicio se borra, los datos se pierden.** Para hacer un respaldo:

- Dile a Claude: *"exporta todos los datos del proyecto a un archivo Excel/JSON"*
- Claude puede crear un endpoint de exportación que descargue todo

> 💡 Recomendación: Haz un respaldo mensual exportando los datos.

---

## Resumen rápido

| Quiero... | Hago... |
|-----------|---------|
| Cambiar datos de draws/fases | Decirle a Claude qué cambiar |
| Cambiar la URL | Ir a Render → Settings → cambiar Name |
| Ver si algo falló | Ir a Render → Logs |
| Agregar funcionalidad | Decirle a Claude qué necesito |
| Hacer respaldo | Pedirle a Claude que exporte los datos |
| Compartir con el equipo | Darles la URL y la contraseña |
