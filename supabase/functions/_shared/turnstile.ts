const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// El widget entrega un token en el navegador, pero ese token no prueba
// nada hasta que Cloudflare lo confirma con la secret key. Por eso la
// validacion vive aqui: la clave nunca sale del servidor.
export async function verificarTurnstile(token: string): Promise<boolean> {
  const secreto = Deno.env.get('TURNSTILE_SECRET_KEY');

  if (!secreto || !token || token.length > 2048) {
    return false;
  }

  const cuerpo = new FormData();
  cuerpo.append('secret', secreto);
  cuerpo.append('response', token);

  try {
    const respuesta = await fetch(SITEVERIFY, {
      method: 'POST',
      body: cuerpo,
      signal: AbortSignal.timeout(10000),
    });

    if (!respuesta.ok) {
      return false;
    }

    const datos = (await respuesta.json()) as { success?: boolean };
    return datos.success === true;
  } catch {
    return false;
  }
}
