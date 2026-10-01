export type EstadoVenta = 'pendiente' | 'pagada' | 'cancelada';

// Lo unico que el checkout manda al servidor sobre el envio.
export interface IDatosEnvio {
  nombreCompleto: string;
  direccion: string;
}

export interface IDetalleVenta {
  id: number;
  venta_id: string;
  product_id: string;
  cantidad: number;
  precio_unitario: number;
  // Llega del join que hace PostgREST con la tabla producto.
  producto: { nombre: string; imagen: string } | null;
}

export interface IVenta {
  id: string;
  estado: EstadoVenta;
  total: number;
  nombre_completo: string;
  direccion: string;
  stripe_session_id: string | null;
  created_at: string;
  detalle_venta: IDetalleVenta[];
}

export interface IEtiquetaEstado {
  texto: string;
  clase: string;
}
