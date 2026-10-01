-- Semana 10: tablas donde queda registrada cada compra.
-- Se puede aplicar con "npx supabase db push" o pegando el archivo
-- en el SQL Editor del dashboard.

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagada', 'cancelada')),
  total numeric(10, 2) not null check (total >= 0),
  nombre_completo text not null,
  direccion text not null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

-- product_id va como uuid porque asi esta declarado el id de la tabla producto.
create table if not exists detalle_venta (
  id bigint generated always as identity primary key,
  venta_id uuid not null references ventas (id) on delete cascade,
  product_id uuid not null references producto (id),
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0)
);

create index if not exists ventas_user_id_idx on ventas (user_id);
create index if not exists detalle_venta_venta_id_idx on detalle_venta (venta_id);

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila: cada usuario ve solo lo suyo y nadie
-- escribe desde el navegador. Las ventas las crea la Edge Function.
-- ---------------------------------------------------------------------
alter table ventas enable row level security;
alter table detalle_venta enable row level security;

drop policy if exists "ver mis ventas" on ventas;
create policy "ver mis ventas" on ventas
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ver mi detalle" on detalle_venta;
create policy "ver mi detalle" on detalle_venta
  for select to authenticated using (
    exists (
      select 1 from ventas v
      where v.id = venta_id and v.user_id = auth.uid()
    )
  );

grant select on ventas, detalle_venta to authenticated;

-- ---------------------------------------------------------------------
-- Marcar la venta como pagada y descontar el stock en una sola
-- operacion. Si Stripe reenvia el evento, el "for update" bloquea la
-- fila y el segundo intento sale por el chequeo de estado.
-- ---------------------------------------------------------------------
create or replace function confirmar_venta(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta ventas%rowtype;
  v_linea record;
begin
  select * into v_venta
  from ventas
  where stripe_session_id = p_session_id
  for update;

  if not found or v_venta.estado <> 'pendiente' then
    return;
  end if;

  for v_linea in
    select product_id, cantidad from detalle_venta where venta_id = v_venta.id
  loop
    update producto
    set stock = stock - v_linea.cantidad
    where id = v_linea.product_id and stock >= v_linea.cantidad;

    if not found then
      raise exception 'Ya no hay stock para confirmar la venta %', v_venta.id;
    end if;
  end loop;

  update ventas set estado = 'pagada' where id = v_venta.id;
end;
$$;

-- Sin este revoke cualquiera podria llamar la funcion desde
-- /rest/v1/rpc y marcar ventas como pagadas sin haber pagado.
revoke all on function confirmar_venta(text) from public, anon, authenticated;
grant execute on function confirmar_venta(text) to service_role;
