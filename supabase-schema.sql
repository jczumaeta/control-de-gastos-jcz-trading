create table if not exists public.gastos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  fecha date not null,
  numero_factura text,
  total_pagado numeric(12, 2) not null check (total_pagado >= 0),
  descripcion text,
  imagen text,
  created_at timestamptz not null default now()
);

alter table public.gastos enable row level security;

create policy "Users can view their own expenses"
  on public.gastos for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on public.gastos for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on public.gastos for delete
  using (auth.uid() = user_id);

create index if not exists gastos_user_fecha_idx
  on public.gastos (user_id, fecha desc);
