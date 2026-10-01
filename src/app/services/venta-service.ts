import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { IProductoCarrito } from '../interfaces/producto.interface';
import { IDatosEnvio, IVenta } from '../interfaces/venta.interface';

const VENTAS_URL = `${environment.supabaseUrl}/ventas`;
const CREAR_CHECKOUT_URL = `${environment.supabaseFuncionesUrl}/crear-checkout`;

// El detalle trae tambien el nombre y la foto del jersey desde producto.
const SELECT_CON_DETALLE = '*,detalle_venta(*,producto(nombre,imagen))';

@Injectable({ providedIn: 'root' })
export class VentaService {
  private http = inject(HttpClient);

  // Del carrito solo salen ids y cantidades: el precio y el total los
  // calcula la Edge Function leyendo la tabla producto.
  crearCheckout(items: IProductoCarrito[], envio: IDatosEnvio, captchaToken: string) {
    return this.http.post<{ url: string }>(CREAR_CHECKOUT_URL, {
      items: items.map((item) => ({ product_id: item.id, cantidad: item.cantidad })),
      envio,
      captchaToken,
    });
  }

  // La usa la pagina de exito para esperar a que el webhook confirme.
  obtenerPorSesion(sessionId: string) {
    return this.http
      .get<IVenta[]>(VENTAS_URL, {
        params: { stripe_session_id: `eq.${sessionId}`, select: SELECT_CON_DETALLE },
      })
      .pipe(map((ventas) => ventas[0] ?? null));
  }

  // No hace falta filtrar por usuario: con RLS la API solo devuelve las suyas.
  misVentas() {
    return this.http.get<IVenta[]>(VENTAS_URL, {
      params: { select: SELECT_CON_DETALLE, order: 'created_at.desc' },
    });
  }
}
