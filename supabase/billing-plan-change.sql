-- Troca de plano pelo admin (cliente comprou o plano errado).
-- O admin muda o plano de uma assinatura paga por Pix, e o preço guardado nela passa a ser o do plano
-- novo (para a renovação cobrar certo). Antes, um aviso repetido do Mercado Pago sobre o pagamento
-- já feito (estorno, contestação, reenvio) era recusado como "Payment mismatch", porque o valor pago
-- não batia mais com o preço da assinatura, e o estorno nunca era registrado.
-- Agora: pagamento já registrado confere com o valor que foi pago de verdade; pagamento novo
-- continua conferindo com o preço da assinatura. Nada mais muda. Execute no SQL Editor.
create or replace function public.billing_apply_payment(
  p_id uuid,p_payment_id text,p_invoice_id text,p_status text,p_amount integer,p_currency text,p_live boolean,
  p_start timestamptz,p_end timestamptz,p_approved timestamptz,p_modified timestamptz,
  p_hash text,p_prefix text,p_encrypted_token text,p_upstream_hash text,p_encrypted_upstream text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare item public.billing_subscriptions; previous public.billing_payments; client_id uuid; expiry timestamptz;
begin
  select * into item from public.billing_subscriptions where id=p_id for update;
  if not found then raise exception 'Unknown subscription'; end if;
  if p_currency<>'BRL' or not p_live or p_end<=p_start or p_modified is null then raise exception 'Payment mismatch'; end if;
  if p_status='approved' and p_approved is null then raise exception 'Payment not approved'; end if;
  select * into previous from public.billing_payments where id=p_payment_id for update;
  if found then
    if p_amount<>previous.amount_cents then raise exception 'Payment mismatch'; end if;
    if previous.subscription_id<>p_id or previous.invoice_id<>p_invoice_id then raise exception 'Payment already assigned'; end if;
    if previous.provider_updated_at>p_modified or (previous.status in ('refunded','charged_back') and p_status not in ('refunded','charged_back')) then return false; end if;
    if item.billing_mode='pix' then p_start:=previous.period_start; p_end:=previous.period_end; end if;
    if previous.period_start<>p_start or previous.period_end<>p_end then raise exception 'Payment period changed'; end if;
  else
    if p_amount<>item.amount_cents then raise exception 'Payment mismatch'; end if;
    if item.billing_mode='pix' then
      if p_status<>'approved' then return false; end if;
      p_start:=greatest(p_approved,coalesce(item.paid_until,p_approved));
      p_end:=p_start+interval '30 days';
    end if;
  end if;
  insert into public.billing_payments(id,subscription_id,invoice_id,status,amount_cents,currency,live_mode,period_start,period_end,approved_at,provider_updated_at)
  values(p_payment_id,p_id,p_invoice_id,p_status,p_amount,p_currency,p_live,p_start,p_end,p_approved,p_modified)
  on conflict(id) do update set status=excluded.status,approved_at=excluded.approved_at,provider_updated_at=excluded.provider_updated_at;
  select max(period_end) into expiry from public.billing_payments where subscription_id=p_id and status='approved';
  update public.billing_subscriptions set paid_until=expiry,billing_anchor=coalesce(billing_anchor,greatest(extract(day from p_start at time zone 'UTC')::integer,extract(day from p_end at time zone 'UTC')::integer)) where id=p_id;
  if expiry>now() and not exists(select 1 from public.billing_access where subscription_id=p_id) then
    if p_hash !~ '^[0-9a-f]{64}$' or p_upstream_hash !~ '^[0-9a-f]{64}$' or p_encrypted_token is null or p_encrypted_upstream is null then raise exception 'Invalid credential'; end if;
    insert into public.gateway_clients(name,token_hash,enabled) values('Assinatura · '||p_id::text,p_upstream_hash,true) returning id into client_id;
    insert into public.billing_access(subscription_id,user_id,gateway_client_id,token_hash,token_prefix,encrypted_token,encrypted_upstream)
    values(p_id,item.user_id,client_id,p_hash,p_prefix,p_encrypted_token,p_encrypted_upstream);
  end if;
  return true;
end;
$$;
revoke all on function public.billing_apply_payment(uuid,text,text,text,integer,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_apply_payment(uuid,text,text,text,integer,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,text,text) to service_role;
