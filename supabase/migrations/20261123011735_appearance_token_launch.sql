begin;

select public.seed_runtime_item_sources_v1('[
  {
    "schemaVersion": 2,
    "id": "item.appearance-token",
    "contentVersion": 1,
    "name": "Appearance Token",
    "description": "Spend one token in Appearance & Title to confirm a different character look.",
    "sortOrder": 0,
    "enabled": true,
    "media": {"artworkId":"item.gatewarden-token.art.v1"},
    "inventoryCategory": "general",
    "itemClass": "general",
    "tier": "D",
    "qualityPoints": 0,
    "equipment": null,
    "maximumStack": 99,
    "requirements": null,
    "ability": null,
    "battleUses": null,
    "consumeOnUse": false,
    "tags": ["cosmetic"]
  }
]'::jsonb);

do $grant$
declare
  target record;
  inventory_revision bigint;
begin
  for target in
    select c.id, c.user_id
    from public.characters c
    -- The live launch fixed this cohort. Replaying the source migration later
    -- cannot extend the one-time grant to characters created since launch.
    where c.created_at <= timestamptz '2026-11-23 01:21:54.587976+00'
    and not exists (
      select 1 from app_private.character_item_grants g
      where g.character_id = c.id and g.grant_key = 'appearance-token-launch'
    )
    order by c.user_id, c.id
  loop
    perform app_private.lock_character_item_inventory_v1(target.user_id, target.id, false);
    select revision into strict inventory_revision
      from app_private.character_item_inventory where character_id = target.id;
    perform public.grant_character_items_v1(
      target.user_id, target.id, inventory_revision, 'appearance-token-launch',
      '[{"itemId":"item.appearance-token","quantity":99}]'::jsonb
    );
  end loop;
end;
$grant$;

commit;
