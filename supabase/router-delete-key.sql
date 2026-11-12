-- Botão "Apagar" das chaves do Roteador (/admin → Roteador).
-- Rode uma vez no SQL Editor do Supabase. Não mexe em nenhuma chave existente.
--
-- Apagar tira a chave da lista e ela para de funcionar na hora. Não dá para desfazer.
-- O consumo que ela já fez continua guardado no histórico.
begin;

grant delete on public.router_keys to service_role;

create or replace function public.router_delete_key(p_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare client uuid;
begin
  delete from public.router_keys where id = p_id returning gateway_client_id into client;
  if not found then return false; end if;
  -- O cadastro interno fica (guarda o histórico de consumo), mas desligado de vez.
  update public.gateway_clients set enabled = false, revoked_at = coalesce(revoked_at, now()) where id = client;
  return true;
end;
$$;

revoke all on function public.router_delete_key(uuid) from public, anon, authenticated;
grant execute on function public.router_delete_key(uuid) to service_role;

commit;

notify pgrst, 'reload schema';
