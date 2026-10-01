import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth-service';

const SUPABASE_ORIGIN = new URL(environment.supabaseUrl).origin;
const RUTA_FUNCIONES = '/functions/v1/';

// Toda peticion a Supabase sale firmada: siempre la apikey del proyecto y,
// si hay sesion iniciada, el JWT del usuario en vez de la llave anonima.
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  let url: URL;

  try {
    url = new URL(req.url);
  } catch {
    return next(req);
  }

  if (url.origin !== SUPABASE_ORIGIN) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  const cabeceras: Record<string, string> = {
    apikey: environment.supabaseKey,
    Authorization: `Bearer ${token ?? environment.supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Prefer es una cabecera de PostgREST. A las Edge Functions no les sirve
  // de nada y encima el navegador bloquea la peticion, porque el CORS de
  // las funciones no la tiene en su lista de permitidas.
  const esFuncion = url.pathname.startsWith(RUTA_FUNCIONES);

  // Si la peticion trae su propio Prefer (count=exact al paginar) no lo pisamos.
  if (!esFuncion && !req.headers.has('Prefer')) {
    cabeceras['Prefer'] = 'return=representation';
  }

  return next(req.clone({ setHeaders: cabeceras }));
};
