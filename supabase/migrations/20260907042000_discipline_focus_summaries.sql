begin;

update app_private.discipline_definitions
set summary = case discipline_id
  when 'vanguard' then 'Balanced armed combat. Focus: Might and Vitality.'
  when 'farstrider' then 'Ranged combat and battlefield awareness. Focus: Finesse and Agility.'
  when 'shadehand' then 'Mobility, trickery, and opportunism. Focus: Finesse and Agility.'
  when 'ironfist' then 'Unarmed martial combat. Focus: Might and Agility.'
  when 'aetherist' then 'Foundation offensive magic. Focus: Intellect and Resolve.'
  when 'lifebinder' then 'Foundation healing and support magic. Focus: Intellect and Resolve.'
  else summary
end
where discipline_id in ('vanguard', 'farstrider', 'shadehand', 'ironfist', 'aetherist', 'lifebinder');

commit;
