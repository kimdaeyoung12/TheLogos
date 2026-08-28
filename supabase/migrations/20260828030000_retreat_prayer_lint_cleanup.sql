-- The initial hosted deployment included an explicit declaration for a FOR
-- loop variable. PostgreSQL creates integer FOR variables automatically, so
-- the declaration was unused and shadowed by each loop. Keep this migration a
-- no-op on clean installs where the declaration is already absent.
do $$
declare
  function_definition text;
  clean_definition text;
begin
  select pg_get_functiondef(
    'public.apply_live_action(uuid,bigint,text,jsonb)'::regprocedure
  ) into function_definition;

  clean_definition := regexp_replace(
    function_definition,
    E'\n[[:space:]]*step_index integer;[[:space:]]*\n',
    E'\n',
    'i'
  );

  if clean_definition is distinct from function_definition then
    execute clean_definition;
  end if;
end
$$;
