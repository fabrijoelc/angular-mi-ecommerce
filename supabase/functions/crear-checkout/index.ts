import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, responder } from '../_shared/cors.ts';
import { verificarTurnstile } from '../_shared/turnstile.ts';
import { origenPermitido } from '../_shared/origen.ts';

// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen en toda Edge
// Function; solo STRIPE_SECRET_KEY se configura con secrets set.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Mismo descuento que calcula CarritoService: 10% pasando los S/ 200.
const CUPON_ID = 'jerseys-nba-10';
const MINIMO_DESCUENTO = 200;

interface ILineaPedido {
  product_id: string;
  cantidad: number;
}

interface IProducto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

// El cupon se crea una sola vez y despues se reutiliza, asi no queda
// un cupon nuevo en Stripe por cada compra.
async function cuponDescuento(stripe: Stripe) {
  try {
    return await stripe.coupons.retrieve(CUPON_ID);
  } catch {
    return await stripe.coupons.create({
      id: CUPON_ID,
      percent_off: 10,
      duration: 'once',
      name: 'Descuento por compra mayor a S/ 200',
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return responder({ error: 'Metodo no permitido' }, 405);
  }

  const claveStripe = Deno.env.get('STRIPE_SECRET_KEY');

  if (!claveStripe) {
    console.error('Falta configurar STRIPE_SECRET_KEY');
    return responder({ error: 'El pago no esta configurado' }, 500);
  }

  const origen = origenPermitido(req.headers.get('origin'));

  if (!origen) {
    return responder({ error: 'Dominio no autorizado' }, 403);
  }

  // 1. El usuario sale del JWT, no de lo que mande el navegador.
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const {
    data: { user },
  } = await supabase.auth.getUser(jwt);

  if (!user) {
    return responder({ error: 'No autenticado' }, 401);
  }

  let cuerpo: {
    items?: ILineaPedido[];
    envio?: { nombreCompleto?: string; direccion?: string };
    captchaToken?: string;
  };

  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: 'Solicitud invalida' }, 400);
  }

  const items = cuerpo.items ?? [];
  const nombreCompleto = cuerpo.envio?.nombreCompleto?.trim();
  const direccion = cuerpo.envio?.direccion?.trim();

  if (!Array.isArray(items) || items.length === 0 || !nombreCompleto || !direccion) {
    return responder({ error: 'Completa los datos de envio y agrega jerseys al carrito' }, 400);
  }

  const cantidadesValidas = items.every(
    (item) =>
      typeof item?.product_id === 'string' &&
      Number.isInteger(item?.cantidad) &&
      item.cantidad > 0 &&
      item.cantidad <= 50,
  );

  if (!cantidadesValidas) {
    return responder({ error: 'Las cantidades del carrito no son validas' }, 400);
  }

  // 2. El captcha se valida antes de escribir nada en la base.
  if (!(await verificarTurnstile(cuerpo.captchaToken ?? ''))) {
    return responder({ error: 'Captcha invalido, vuelve a marcarlo' }, 400);
  }

  // 3. Precios y stock se leen de la base: del cliente solo llegan
  //    los ids y las cantidades.
  const ids = items.map((item) => item.product_id);
  const { data: filas, error: errorProductos } = await supabase
    .from('producto')
    .select('id, nombre, precio, stock')
    .in('id', ids);

  if (errorProductos) {
    console.error('No se pudieron leer los productos', errorProductos);
    return responder({ error: 'No se pudieron validar los jerseys' }, 500);
  }

  const productos = (filas ?? []) as IProducto[];
  const porId = new Map(productos.map((producto) => [String(producto.id), producto]));

  if (items.some((item) => !porId.has(item.product_id))) {
    return responder({ error: 'Alguno de los jerseys ya no esta disponible' }, 409);
  }

  const sinStock = items.find((item) => porId.get(item.product_id)!.stock < item.cantidad);

  if (sinStock) {
    return responder({ error: `Ya no hay stock de ${porId.get(sinStock.product_id)!.nombre}` }, 409);
  }

  // 4. Las lineas de Stripe van en centimos.
  const lineas = items.map((item) => {
    const producto = porId.get(item.product_id)!;

    return {
      quantity: item.cantidad,
      price_data: {
        currency: 'pen',
        unit_amount: Math.round(Number(producto.precio) * 100),
        product_data: { name: producto.nombre },
      },
    };
  });

  const subtotal = lineas.reduce(
    (acc, linea) => acc + linea.price_data.unit_amount * linea.quantity,
    0,
  );
  const aplicaDescuento = subtotal > MINIMO_DESCUENTO * 100;
  const total = Math.round(subtotal * (aplicaDescuento ? 0.9 : 1)) / 100;

  // 5. La venta queda pendiente: solo el webhook la marca como pagada.
  const { data: venta, error: errorVenta } = await supabase
    .from('ventas')
    .insert({
      user_id: user.id,
      total,
      nombre_completo: nombreCompleto,
      direccion,
    })
    .select('id')
    .single();

  if (errorVenta || !venta) {
    console.error('No se pudo crear la venta', errorVenta);
    return responder({ error: 'No se pudo registrar la compra' }, 500);
  }

  const { error: errorDetalle } = await supabase.from('detalle_venta').insert(
    items.map((item) => ({
      venta_id: venta.id,
      product_id: item.product_id,
      cantidad: item.cantidad,
      precio_unitario: Number(porId.get(item.product_id)!.precio),
    })),
  );

  if (errorDetalle) {
    await supabase.from('ventas').delete().eq('id', venta.id);
    console.error('No se pudo guardar el detalle', errorDetalle);
    return responder({ error: 'No se pudo registrar el detalle de la compra' }, 500);
  }

  // 6. Sesion de Checkout. {CHECKOUT_SESSION_ID} se escribe literal:
  //    Stripe lo reemplaza al devolver al usuario.
  try {
    const stripe = new Stripe(claveStripe);
    const cupon = aplicaDescuento ? await cuponDescuento(stripe) : null;

    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineas,
      ...(cupon ? { discounts: [{ coupon: cupon.id }] } : {}),
      customer_email: user.email ?? undefined,
      success_url: `${origen}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origen}/pago/cancelado`,
      metadata: { venta_id: venta.id },
    });

    if (!sesion.url) {
      throw new Error('Stripe no devolvio la URL de pago');
    }

    await supabase.from('ventas').update({ stripe_session_id: sesion.id }).eq('id', venta.id);

    return responder({ url: sesion.url });
  } catch (error) {
    // Si Stripe falla la venta pendiente no debe quedar colgada.
    await supabase.from('ventas').delete().eq('id', venta.id);
    console.error('Stripe Checkout fallo', error);
    return responder({ error: 'No se pudo iniciar el pago' }, 502);
  }
});
