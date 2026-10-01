import { corsHeaders, responder } from '../_shared/cors.ts';
import { verificarTurnstile } from '../_shared/turnstile.ts';

// Se despliega con --no-verify-jwt: solo valida un token y no toca
// datos del usuario, asi que no necesita sesion iniciada.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return responder({ error: 'Metodo no permitido' }, 405);
  }

  let token: unknown;

  try {
    token = (await req.json()).token;
  } catch {
    return responder({ error: 'Solicitud invalida' }, 400);
  }

  if (typeof token !== 'string' || !token) {
    return responder({ valido: false }, 400);
  }

  const valido = await verificarTurnstile(token);
  return responder({ valido }, valido ? 200 : 400);
});
