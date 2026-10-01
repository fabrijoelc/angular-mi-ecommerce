// El origen de la peticion decide a donde vuelve Stripe despues de pagar.
// Solo se aceptan localhost y el dominio del despliegue para que nadie
// pueda colar una URL de retorno ajena.
export function origenPermitido(origen: string | null): string | null {
  if (!origen) {
    return null;
  }

  try {
    const url = new URL(origen);
    const host = url.hostname;
    const esLocal = host === 'localhost' || host === '127.0.0.1';

    if (esLocal || host.endsWith('.vercel.app')) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}
