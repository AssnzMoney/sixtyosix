-- Verificação apenas: não grava nenhuma entrega permanente (tudo é desfeito no rollback).
-- Rode depois de aplicar supabase/whatsapp-delivery.sql.
begin;
do $$
declare
  u uuid; other uuid; first_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid();
  got uuid; confirmed timestamptz; again timestamptz;
begin
  select id into u from auth.users where email_confirmed_at is not null order by created_at limit 1;
  select id into other from auth.users where email_confirmed_at is not null and id <> u order by created_at limit 1;
  if u is null or other is null then raise exception 'São necessárias duas contas confirmadas para esta verificação'; end if;

  got := public.admin_register_delivery(first_id, u, null, 'claude', 'Fornecedor QA', '9f3a', 'https://api.qa.example', 'claude-fable-5-1', null, now() + interval '30 days', null, 'qa@sixtysix.dev');
  if got <> first_id then raise exception 'Registro falhou'; end if;
  if public.admin_register_delivery(first_id, u, null, 'claude', 'Fornecedor QA', '9f3a', 'https://api.qa.example', null, null, null, null, 'qa@sixtysix.dev') <> first_id
     or (select count(*) from public.credential_deliveries where id = first_id) <> 1 then
    raise exception 'Clique duplo criou duas entregas';
  end if;
  if public.admin_register_delivery(gen_random_uuid(), other, null, 'gpt', 'Fornecedor QA', 'ab12', 'https://api.qa.example', null, null, null, first_id, 'qa@sixtysix.dev') is not null then
    raise exception 'Substituiu credencial de outro cliente';
  end if;

  begin
    perform public.admin_register_delivery(gen_random_uuid(), u, null, 'claude', 'Fornecedor QA', 'sk-ant-api03-segredo', 'https://api.qa.example', null, null, null, null, 'qa@sixtysix.dev');
    raise exception 'Aceitou a chave inteira no final da chave';
  exception when check_violation then null;
  end;

  if public.account_confirm_delivery(other, first_id, '1.1.1.1', 'qa', 'texto', 'v1') is not null then
    raise exception 'Outro cliente confirmou a entrega';
  end if;
  confirmed := public.account_confirm_delivery(u, first_id, '1.1.1.1', 'qa-agent', 'Confirmo que recebi', 'v1');
  if confirmed is null then raise exception 'Confirmação do dono falhou'; end if;
  again := public.account_confirm_delivery(u, first_id, '2.2.2.2', 'outro-agent', 'outro texto', 'v2');
  if again <> confirmed or (select confirm_ip from public.credential_deliveries where id = first_id) <> '1.1.1.1' then
    raise exception 'Confirmação foi reescrita';
  end if;

  begin
    update public.credential_deliveries set confirm_ip = '9.9.9.9' where id = first_id;
    raise exception 'Prova de confirmação foi alterada';
  exception when raise_exception then
    if sqlerrm = 'Prova de confirmação foi alterada' then raise; end if;
  end;

  if public.admin_register_delivery(second_id, u, null, 'claude', 'Fornecedor QA', '77aa', 'https://api.qa.example', null, null, null, first_id, 'qa@sixtysix.dev') <> second_id then
    raise exception 'Rotação falhou';
  end if;
  if (select replaced_at from public.credential_deliveries where id = first_id) is null then raise exception 'Entrega anterior não foi substituída'; end if;
  if public.account_confirm_delivery(u, first_id, '1.1.1.1', 'qa', 'x', 'v1') is not null then raise exception 'Confirmou credencial substituída'; end if;
  if not public.admin_revoke_delivery(second_id, 'qa@sixtysix.dev') or public.admin_revoke_delivery(second_id, 'qa@sixtysix.dev') then
    raise exception 'Revogação não é única';
  end if;

  if has_table_privilege('anon', 'public.credential_deliveries', 'select') or has_table_privilege('authenticated', 'public.credential_deliveries', 'select')
     or has_table_privilege('authenticated', 'public.credential_deliveries', 'insert') or has_table_privilege('service_role', 'public.credential_deliveries', 'delete') then
    raise exception 'Tabela exposta ou com exclusão permitida';
  end if;
  if has_function_privilege('authenticated', 'public.account_confirm_delivery(uuid,uuid,text,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.admin_register_delivery(uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,uuid,text)', 'execute') then
    raise exception 'RPC exposta ao navegador';
  end if;
end;
$$;
rollback;
select 'passed: entrega, idempotência, isolamento, confirmação imutável, rotação, revogação, privilégios' as result;
