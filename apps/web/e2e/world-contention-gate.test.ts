import { expect, it } from 'vitest'
import {
  diagnoseWorldEquipmentDefinition,
  parseWorldEquipmentErrors,
  parseWorldEquipmentLockHolders,
} from './world-contention-gate'

const application = 'atlas-gate-1234-abcd'
const ids = ['11111111-1111-1111-1111-111111111111']
const definition = `CREATE OR REPLACE FUNCTION public.read_character_battle_equipment_v1(p_user_id uuid,p_character_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare inventory jsonb;
begin
 inventory:=public.read_character_item_inventory_v1(p_user_id,p_character_id);
 return inventory;
end; $function$`

it('preserves the equipment body and rethrows after fixture-scoped sanitized error capture', () => {
  const result = diagnoseWorldEquipmentDefinition(definition, application, ids)
  expect(result).toContain(
    'inventory:=public.read_character_item_inventory_v1(p_user_id,p_character_id);',
  )
  expect(result).toContain('exception when others then')
  expect(result).toContain(`p_character_id=any(array['${ids[0]}'::uuid])`)
  expect(result).toContain('SQLSTATE')
  expect(result).toContain('ITEM_ADMISSION_RETRY')
  expect(result).toContain("else 'OTHER' end")
  expect(result).toContain('raise;\nend; $function$')
  expect(result).not.toContain('pg_sleep')
})
it('fails closed for changed predecessors and untrusted gate identities', () => {
  expect(() => diagnoseWorldEquipmentDefinition('begin\nreturn null;', application, ids)).toThrow()
  expect(() => diagnoseWorldEquipmentDefinition(definition, "bad'identity", ids)).toThrow()
  expect(() => diagnoseWorldEquipmentDefinition(definition, application, ["bad'uuid"])).toThrow()
})
it('retains only this fixture marker, SQLSTATE and allowlisted category; never SQL or credentials', () => {
  const logs = `secret-query password=private\nLOG: AUREVANE_ATLAS_ITEM ${application} 40001 ITEM_ADMISSION_RETRY\nCONTEXT: SQL with credentials\nLOG: AUREVANE_ATLAS_ITEM atlas-gate-5678 40001 ITEM_CATALOGUE_RETRY\nLOG: AUREVANE_ATLAS_ITEM ${application} 40001 secret-query\nLOG: AUREVANE_ATLAS_ITEM ${application} PT409 OTHER\n`
  expect(parseWorldEquipmentErrors(logs, application)).toEqual([
    { sqlState: '40001', category: 'ITEM_ADMISSION_RETRY' },
    { sqlState: 'PT409', category: 'OTHER' },
  ])
})

it('retains only lock identity and trusted public RPC names, rejecting raw query fields', () => {
  const prefix = `LOG: AUREVANE_ATLAS_LOCK ${application} `
  expect(
    parseWorldEquipmentLockHolders(
      prefix + '[{"lock":"account1","rpc":"commit_world_state_v1"}]',
      application,
    ),
  ).toEqual([[{ lock: 'account1', rpc: 'commit_world_state_v1' }]])
  expect(() =>
    parseWorldEquipmentLockHolders(
      prefix + '[{"lock":"account1","rpc":"commit_world_state_v1","query":"secret"}]',
      application,
    ),
  ).toThrow('Invalid disposable World lock diagnostic.')
  expect(() =>
    parseWorldEquipmentLockHolders(
      prefix + '[{"lock":"account1","rpc":"secret value"}]',
      application,
    ),
  ).toThrow('Invalid disposable World lock diagnostic.')
  expect(parseWorldEquipmentLockHolders('LOG: another fixture []', application)).toEqual([])
})
