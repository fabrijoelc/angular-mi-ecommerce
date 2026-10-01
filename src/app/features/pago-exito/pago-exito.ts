import { Component, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, switchMap, take, takeWhile, timer } from 'rxjs';
import { VentaService } from '../../services/venta-service';
import { CarritoService } from '../../services/carrito-service';
import { EstadoVentaPipe } from '../../pipes/estado-venta-pipe';

@Component({
  selector: 'app-pago-exito',
  imports: [RouterLink, EstadoVentaPipe],
  templateUrl: './pago-exito.html',
})
export class PagoExito {
  private ventaService = inject(VentaService);
  private carritoService = inject(CarritoService);

  // El session_id llega como query param y entra solo al input gracias a
  // withComponentInputBinding.
  sessionId = input('', { alias: 'session_id' });

  // Llegar a esta pagina no prueba que se pago: quien confirma es el
  // webhook de Stripe. Aqui solo se consulta cada 2 segundos hasta que
  // la venta deje de estar pendiente.
  venta = toSignal(
    toObservable(this.sessionId).pipe(
      switchMap((id) =>
        !id
          ? []
          : timer(0, 2000).pipe(
              switchMap(() => this.ventaService.obtenerPorSesion(id)),
              takeWhile((venta) => !venta || venta.estado === 'pendiente', true),
              // Tope de 20 consultas para no quedarse preguntando sin fin.
              take(20),
            ),
      ),
    ),
  );

  // Pasados 30 segundos sin confirmacion se muestra un mensaje de ayuda.
  private tiempoAgotado = toSignal(timer(30000).pipe(map(() => true)), { initialValue: false });

  confirmada = computed(() => this.venta()?.estado === 'pagada');
  cancelada = computed(() => this.venta()?.estado === 'cancelada');
  esperando = computed(() => !!this.sessionId() && !this.confirmada() && !this.cancelada());
  demorado = computed(() => this.tiempoAgotado() && this.esperando());

  constructor() {
    // Cuando el pago queda confirmado el carrito se vacia, y el effect()
    // del servicio se encarga de limpiar tambien LocalStorage.
    effect(() => {
      if (this.confirmada() && this.carritoService.items().length > 0) {
        this.carritoService.vaciar();
      }
    });
  }

  subtotalLinea(cantidad: number, precio: number) {
    return cantidad * precio;
  }
}
