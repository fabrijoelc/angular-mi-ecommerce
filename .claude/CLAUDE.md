# Tienda de Jerseys NBA

E-commerce de camisetas de la NBA hecho en el curso de Angular de Tecsup.
Autor: Fabrizio Allcca.

## Stack

- Angular 20 con componentes standalone y signals.
- Tailwind CSS v4 para los estilos.
- Supabase como backend: PostgREST para los datos, Auth para la sesion y
  Edge Functions para lo que no puede correr en el navegador.
- Stripe Checkout para el pago, en modo de prueba.

## Convenciones del proyecto

- Nombres de archivos, variables y comentarios en espanol, sin tildes en
  los identificadores.
- Las peticiones a Supabase se hacen con HttpClient, nunca con la libreria
  supabase-js (esa solo se usa dentro de las Edge Functions).
- El interceptor `apiKeyInterceptor` agrega la apikey y el JWT: ningun
  servicio vuelve a poner esas cabeceras a mano.
- Estado con signals y computed. Nada de BehaviorSubject para el estado.
- Las tablas de Supabase son `producto`, `ventas` y `detalle_venta`.

## Reglas de pagos, captcha y Edge Functions

- Las Edge Functions viven en `supabase/functions` y corren en Deno.
- En Edge Functions los paquetes se importan con el prefijo `npm:`
  (por ejemplo `npm:stripe`).
- Las claves secretas (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  TURNSTILE_SECRET_KEY, service role de Supabase) solo se configuran con
  `npx supabase secrets set`.
- Nunca escribir claves secretas en `environment.ts` ni en ningun archivo
  de Angular. Solo van valores publicos: la URL del proyecto, la anon key
  y la site key de Turnstile.
- El frontend nunca envia precios: manda ids y cantidades, y el servidor
  lee los precios de la tabla `producto`.
- El frontend nunca recibe ni guarda datos de tarjeta: el pago ocurre en
  la pagina de Stripe Checkout.
- El captcha se valida en la misma funcion que crea el pago, no en una
  aparte, porque si no se puede saltar llamando directo a la segunda.
- El stock se descuenta solo cuando Stripe confirma el pago por webhook,
  dentro de la funcion SQL `confirmar_venta`.
