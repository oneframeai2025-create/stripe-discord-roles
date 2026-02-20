# Stripe Discord Roles + Post Analyzer

Webhook server que asigna roles de Discord automáticamente basándose en suscripciones de Stripe + Bot analizador de posts con IA.

## Características

- ✅ Webhook de Stripe con validación de firma
- ✅ Asignación/eliminación automática de roles en Discord
- ✅ **Análisis de posts con OpenAI (gpt-4o-mini)**
- ✅ Feedback honesto y constructivo (0-10)
- ✅ TypeScript + Fastify
- ✅ Listo para Railway

## Bot Analizador de Posts

El bot analiza automáticamente posts escritos en `#laboratorio-de-ganchos` y da feedback:

**Qué analiza:**
- Hooks emocionales
- Estructura y formato
- Engagement (preguntas, listas)
- Claridad del mensaje
- Valor aportado

**Feedback incluye:**
- Puntuación 0-10
- Lo que funciona
- Lo que falla (con soluciones específicas)
- Mejora clave

**El bot es honesto:** si el post es malo, lo dirá sin rodeos.

## Configuración

### 1. Crear Discord Bot

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación
3. En "Bot", crea un bot y copia el token
4. En "OAuth2" > "URL Generator":
   - Scopes: `bot`
   - Bot Permissions: `Manage Roles`
5. Usa la URL generada para invitar el bot a tu servidor

### 2. Obtener IDs de Discord

**Guild ID (Servidor):**
1. En Discord, activa Modo Desarrollador (Configuración > Avanzado)
2. Click derecho en tu servidor → Copiar ID del servidor

**Role IDs:**
1. En Configuración del servidor → Roles
2. Click derecho en el rol → Copiar ID del rol

### 3. Configurar Stripe

**Productos:**
1. Ve a tus productos en Stripe Dashboard
2. Copia el Product ID (empieza con `prod_`)

**Webhook:**
1. Stripe Dashboard → Developers → Webhooks
2. Añade endpoint: `https://tu-dominio.railway.app/webhook/stripe`
3. Eventos a escuchar:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el Webhook Signing Secret

### 4. Variables de Entorno

En Railway (o `.env` local):

```env
PORT=3000
NODE_ENV=production

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Discord
DISCORD_BOT_TOKEN=MTIzNDU2...
DISCORD_GUILD_ID=123456789

# OpenAI (para análisis de posts)
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# Mapeo producto:rol (separado por comas)
ROLE_MAPPING=prod_abc123:987654321,prod_def456:123456789
```

**Para obtener las credenciales de OpenAI:**

1. **API Key:**
   - Ve a https://platform.openai.com/api-keys
   - Crea una nueva API key
   - Cópiala (empieza con `sk-...`)

2. **Organization ID:**
   - Ve a https://platform.openai.com/settings/organization/general
   - Copia el "Organization ID" (empieza con `org-...`)

3. Pega ambas en Railway como variables de entorno

### 5. Metadata en Stripe

Para vincular usuarios de Stripe con Discord, añade esto a los **Customer metadata** en Stripe:

```
discord_user_id: 123456789012345678
```

Puedes hacerlo:
- Manualmente en Stripe Dashboard
- Programáticamente con la API de Stripe
- Durante el checkout (custom fields)

## Deployment en Railway

1. Conecta este repositorio a Railway
2. Añade las variables de entorno
3. Railway detectará el `package.json` y desplegará automáticamente

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Copiar .env.example a .env y configurar
cp .env.example .env

# Desarrollo con hot-reload
npm run dev

# Build de producción
npm run build
npm start
```

## Testing del Webhook

Usa Stripe CLI para testear localmente:

```bash
stripe listen --forward-to localhost:3000/webhook/stripe
stripe trigger customer.subscription.created
```

## Logs

El servidor registra:
- ✅ Eventos recibidos de Stripe
- ✅ Roles asignados/eliminados
- ❌ Errores de validación o procesamiento

## Seguridad

- ✅ Validación de firma de Stripe
- ✅ Variables de entorno para secretos
- ✅ CORS configurado
- ✅ Raw body parsing para webhooks

## Troubleshooting

**"No Discord user ID found"**
→ Añade `discord_user_id` al metadata del customer en Stripe

**"Role not found"**
→ Verifica que el bot tenga permisos y que el role ID sea correcto

**"Invalid signature"**
→ Verifica que el `STRIPE_WEBHOOK_SECRET` sea correcto

**Bot no asigna roles**
→ El bot debe tener un rol SUPERIOR al rol que intenta asignar
