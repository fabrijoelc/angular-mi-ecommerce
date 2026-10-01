import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Se despliega con --no-verify-jwt porque quien llama es Stripe, no un
// usuario. La seguridad la da la firma del evento.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Metodo no permitido', { status: 405 });
  }

  const claveStripe = Deno.env.get('STRIPE_SECRET_KEY');
  const claveWebhook = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!claveStripe || !claveWebhook) {
    console.error('Falta configurar las claves de Stripe');
    return new Response('Webhook sin configurar', { status: 500 });
  }

  const firma = req.headers.get('stripe-signature');

  if (!firma) {
    return new Response('Falta la firma', { status: 400 });
  }

  // El cuerpo se lee como texto: la firma se calcula sobre el texto
  // exacto que mando Stripe, asi que no se puede parsear antes.
  const cuerpo = await req.text();
  let evento: Stripe.Event;

  const stripe = new Stripe(claveStripe);

  try {
    evento = await stripe.webhooks.constructEventAsync(
      cuerpo,
      firma,
      claveWebhook,
      undefined,
      // En Deno la verificacion es asincrona y usa esta implementacion.
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error('Firma invalida', error);
    return new Response('Firma invalida', { status: 400 });
  }

  if (evento.type === 'checkout.session.completed') {
    const sesion = evento.data.object as Stripe.Checkout.Session;

    if (sesion.payment_status !== 'paid') {
      return new Response('ok', { status: 200 });
    }

    // Marcar como pagada y descontar stock ocurre dentro de la funcion
    // SQL, en una sola transaccion.
    const { error } = await supabase.rpc('confirmar_venta', { p_session_id: sesion.id });

    if (error) {
      console.error('No se pudo confirmar la venta', error);
      return new Response('No se pudo confirmar', { status: 500 });
    }
  }

  if (evento.type === 'checkout.session.expired') {
    const sesion = evento.data.object as Stripe.Checkout.Session;

    await supabase
      .from('ventas')
      .update({ estado: 'cancelada' })
      .eq('stripe_session_id', sesion.id)
      .eq('estado', 'pendiente');
  }

  // Cualquier otro evento se acepta sin hacer nada: si respondemos un
  // error Stripe lo reintenta una y otra vez.
  return new Response('ok', { status: 200 });
});
