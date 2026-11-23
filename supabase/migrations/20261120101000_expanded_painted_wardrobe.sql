begin;

create function app_private.valid_painted_wardrobe_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    p_url ~ '^/api/media/appearance/5/[a-z]+(\.[a-z]+){10}((\.[a-z]+){3})?/neutral\.svg$'
    and length(split_part(p_url, '/', 6)) <= 140
    and parts[1] in ('scout','ranger','guard','elder')
    and parts[2] in ('none','compass','pine','hawkmantle','shearling','scarf','brigandine','brocade','hooded','quilted')
    and parts[4] in ('none','utility','mapcase','potions','bedroll','journal','rope','sword','girdle')
    and parts[6] in ('none','arcanist','bandana','furcap','circlet')
    and parts[8] in ('none','eyepatch','goggles','veil','mask')
    and array[parts[3],parts[5],parts[7],parts[9]] <@ array[
      'natural','charcoal','ocean','teal','ice','cobalt','plum','rose','crimson','ember','amber',
      'ochre','pine','sage','ivory','ink','pewter','silver','linen','cream','straw','clay','rust',
      'leather','walnut','oxblood','wine','violet','lilac','midnight','denim','rain','glacier',
      'lagoon','mint','cedar','olive','fern','moss','gold','buttercup','coral','shell','garnet','carmine'
    ]
    and (parts[2] <> 'none' or parts[3] = 'natural')
    and (parts[4] <> 'none' or parts[5] = 'natural')
    and (parts[6] <> 'none' or parts[7] = 'natural')
    and (parts[8] <> 'none' or parts[9] = 'natural')
    and parts[10] in ('natural','slight','lean','strong','broad','stocky')
    and parts[11] in ('natural','alabaster','porcelain','peach','sand','olive','bronze','honey',
      'copper','umber','mahogany','cacao','espresso')
    and (cardinality(parts) = 11 or (
      parts[12] in ('natural','feather','quiff','curls','crown','layers','bun','topknot','pony',
        'braid','twins','waves')
      and parts[13] in ('natural','onyx','charcoal','espresso','walnut','chestnut','copper',
        'auburn','ginger','rosewood','honey','ash','flax','silver','platinum','plum','wine',
        'lilac','ocean','teal','moss')
      and parts[14] in ('natural','brown','amber','hazel','green','blue','gray','violet')
      and array[parts[12],parts[13],parts[14]] <> array['natural','natural','natural']
    )), false)
  from (select string_to_array(split_part(p_url, '/', 6), '.') parts) recipe;
$$;
revoke all on function app_private.valid_painted_wardrobe_url_v1(text)
  from public, anon, authenticated, service_role;

do $migration$
declare
  patch record;
  definition text;
begin
  for patch in select * from (values
    ('app_private.valid_npc_appearance_v1(jsonb)',
      'or app_private.valid_painted_appearance_url_v1(value #>> ''{}'')',
      'or app_private.valid_painted_appearance_url_v1(value #>> ''{}'') or app_private.valid_painted_wardrobe_url_v1(value #>> ''{}'')'),
    ('public.commit_character_appearance_v2(uuid,uuid,integer,text)',
      'not app_private.valid_painted_appearance_url_v1(p_image_url)',
      'not app_private.valid_painted_appearance_url_v1(p_image_url) and not app_private.valid_painted_wardrobe_url_v1(p_image_url)')
  ) as edits(signature, predecessor, replacement)
  loop
    definition := pg_get_functiondef(patch.signature::regprocedure);
    if length(definition) - length(replace(definition, patch.predecessor, '')) <> length(patch.predecessor) then
      raise exception 'PAINTED_WARDROBE_PREDECESSOR_MISSING: %', patch.signature;
    end if;
    execute replace(definition, patch.predecessor, patch.replacement);
  end loop;
end;
$migration$;

commit;
