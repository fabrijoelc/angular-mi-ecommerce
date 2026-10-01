import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, tap } from 'rxjs';
import { VentaService } from '../../services/venta-service';
import { EstadoVentaPipe } from '../../pipes/estado-venta-pipe';
import { IVenta } from '../../interfaces/venta.interface';

@Component({
  selector: 'app-mis-compras',
  imports: [RouterLink, DatePipe, EstadoVentaPipe],
  templateUrl: './mis-compras.html',
})
export class MisCompras {
  private ventaService = inject(VentaService);

  cargando = signal(true);
  error = signal('');

  // Gracias a RLS la consulta no filtra por usuario y aun asi la API
  // devuelve solo las compras de quien tiene la sesion abierta.
  ventas = toSignal(
    this.ventaService.misVentas().pipe(
      tap(() => this.cargando.set(false)),
      catchError(() => {
        this.cargando.set(false);
        this.error.set('No pudimos cargar tus compras, recarga la pagina.');
        return of([] as IVenta[]);
      }),
    ),
    { initialValue: [] as IVenta[] },
  );

  vacio = computed(() => !this.cargando() && !this.error() && this.ventas().length === 0);

  // Solo una compra queda abierta a la vez.
  private abierta = signal('');

  estaAbierta(id: string) {
    return this.abierta() === id;
  }

  alternar(id: string) {
    this.abierta.update((actual) => (actual === id ? '' : id));
  }

  subtotalLinea(cantidad: number, precio: number) {
    return cantidad * precio;
  }
}
