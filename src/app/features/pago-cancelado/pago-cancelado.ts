import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CarritoService } from '../../services/carrito-service';

@Component({
  selector: 'app-pago-cancelado',
  imports: [RouterLink],
  templateUrl: './pago-cancelado.html',
})
export class PagoCancelado {
  // El carrito no se toca: solo se avisa y se ofrece volver.
  carritoService = inject(CarritoService);
}
