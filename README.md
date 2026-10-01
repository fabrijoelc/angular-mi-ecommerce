# Tienda de Jerseys NBA

Tienda en linea de camisetas de la NBA, hecha con Angular y Supabase para el
curso de Angular de Tecsup.

Autor: Fabrizio Allcca

## Sitio publicado

https://angular-mi-ecommerce.vercel.app/

El frontend se despliega desde `main` en Vercel. La configuración de build
publica `dist/mi-ecommerce/browser`; las rutas de Angular usan la reescritura
definida en `vercel.json`.

## Que hace

- Catalogo de 20 jerseys con busqueda por nombre, filtro por equipo y
  paginacion en el servidor.
- Detalle de cada jersey con su stock.
- Carrito que se guarda en el navegador, con subtotal, descuento del 10% al
  pasar los S/ 200 y total.
- Registro e inicio de sesion con Supabase Auth.
- Checkout con formulario reactivo, captcha de Cloudflare Turnstile y pago
  con Stripe Checkout.
- La venta queda registrada en Supabase y el stock se descuenta solo cuando
  Stripe confirma el pago.
- Historial de compras del usuario.

## Stack

| Parte | Que se uso |
| --- | --- |
| Framework | Angular 20 (standalone, signals) |
| Estilos | Tailwind CSS v4 |
| Backend | Supabase (PostgREST, Auth, Edge Functions) |
| Pagos | Stripe Checkout (modo de prueba) |
| Captcha | Cloudflare Turnstile |
| Despliegue | Vercel |

## Correrlo en local

```bash
npm install
npm start
```

Queda en `http://localhost:4200`. La URL y la anon key de Supabase ya estan
en `src/environments/environment.ts`: son valores publicos.

Para el build de produccion:

```bash
npm run build
```

La salida queda en `dist/mi-ecommerce/browser`.

## Base de datos

El SQL de las tablas de ventas esta en
`supabase/migrations/20261001120000_ventas.sql`. Se aplica con
`npx supabase db push` o pegandolo en el SQL Editor del dashboard.

## Edge Functions

Las tres funciones viven en `supabase/functions` y corren en Deno:

| Funcion | Que hace |
| --- | --- |
| `verificar-captcha` | Valida un token de Turnstile contra Cloudflare |
| `crear-checkout` | Valida captcha y stock, registra la venta y crea la sesion de Stripe |
| `stripe-webhook` | Verifica la firma de Stripe y confirma la venta |

Las claves secretas no estan en el repositorio: se configuran aparte con
`npx supabase secrets set` y solo existen dentro de Supabase.

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=...
npx supabase secrets set STRIPE_SECRET_KEY=...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=...

npx supabase functions deploy verificar-captcha --no-verify-jwt
npx supabase functions deploy crear-checkout
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

## Probar el pago

En modo de prueba de Stripe se paga con la tarjeta `4242 4242 4242 4242`,
cualquier fecha futura y cualquier CVC.
