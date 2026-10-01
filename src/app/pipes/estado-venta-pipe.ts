import { Pipe, PipeTransform } from '@angular/core';
import { EstadoVenta, IEtiquetaEstado } from '../interfaces/venta.interface';

// Convierte el estado que guarda la base en una etiqueta con color.
@Pipe({ name: 'estadoVenta' })
export class EstadoVentaPipe implements PipeTransform {
  transform(estado: EstadoVenta): IEtiquetaEstado {
    switch (estado) {
      case 'pagada':
        return { texto: 'Pagada', clase: 'bg-emerald-100 text-emerald-700' };
      case 'cancelada':
        return { texto: 'Cancelada', clase: 'bg-red-100 text-red-700' };
      default:
        return { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-700' };
    }
  }
}
