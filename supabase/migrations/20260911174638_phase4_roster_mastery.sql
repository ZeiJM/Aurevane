begin;

-- Additive Phase-4 catalogs. Existing Foundation acquisition and immutable battle records remain valid.

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('bastion',1,'{"maxHp":25,"armor":8,"initiative":-2}'::jsonb,'{"might":5,"finesse":3,"vitality":10,"agility":3,"intellect":2,"resolve":8}'::jsonb,array['vitality','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('bastion',1,'Bastion','Protect allies and limit enemy pressure. Focus: Vitality and Resolve.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('ravager',1,'{"physicalPower":4,"maxHp":10,"ward":-2}'::jsonb,'{"might":10,"finesse":4,"vitality":8,"agility":4,"intellect":2,"resolve":3}'::jsonb,array['might','vitality']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('ravager',1,'Ravager','Bleeding pressure and dangerous offensive commitment. Focus: Might and Vitality.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('edgedancer',1,'{"accuracy":200,"evasion":200,"initiative":2}'::jsonb,'{"might":5,"finesse":9,"vitality":4,"agility":8,"intellect":2,"resolve":3}'::jsonb,array['finesse','agility']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('edgedancer',1,'Edgedancer','Precise melee, facing and openings. Focus: Finesse and Agility.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('wildwarden',1,'{"accuracy":250,"initiative":1}'::jsonb,'{"might":3,"finesse":8,"vitality":5,"agility":7,"intellect":2,"resolve":6}'::jsonb,array['finesse','agility','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('wildwarden',1,'Wildwarden','Control a quarry through snares, marks and attrition. Focus: Finesse, Agility and Resolve.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('runeblade',1,'{"physicalPower":2,"mysticPower":2,"maxMp":5}'::jsonb,'{"might":8,"finesse":4,"vitality":5,"agility":3,"intellect":8,"resolve":3}'::jsonb,array['might','intellect']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('runeblade',1,'Runeblade','Mix melee with mystic pressure and resource control. Focus: Might and Intellect.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('dawnshield',1,'{"armor":4,"ward":4,"maxHp":10}'::jsonb,'{"might":4,"finesse":2,"vitality":8,"agility":3,"intellect":7,"resolve":7}'::jsonb,array['vitality','intellect','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('dawnshield',1,'Dawnshield','Guard, cleanse and restore nearby allies. Focus: Vitality, Intellect and Resolve.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('cinderweaver',1,'{"mysticPower":4,"maxMp":10,"ward":-1}'::jsonb,'{"might":2,"finesse":3,"vitality":4,"agility":4,"intellect":11,"resolve":7}'::jsonb,array['intellect','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('cinderweaver',1,'Cinderweaver','Burn enemies and exploit their exposure to fire. Focus: Intellect and Resolve.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('frostweaver',1,'{"mysticPower":2,"ward":3,"maxMp":10}'::jsonb,'{"might":2,"finesse":3,"vitality":5,"agility":3,"intellect":10,"resolve":8}'::jsonb,array['intellect','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('frostweaver',1,'Frostweaver','Restrict movement and shatter rooted targets. Focus: Intellect and Resolve.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('stormsinger',1,'{"initiative":2,"mysticPower":2,"accuracy":100}'::jsonb,'{"might":2,"finesse":4,"vitality":4,"agility":8,"intellect":9,"resolve":4}'::jsonb,array['agility','intellect']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('stormsinger',1,'Stormsinger','Control lanes and disrupt enemy resources. Focus: Agility and Intellect.',true,true,1);

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('tidecaller',1,'{"ward":2,"maxMp":15}'::jsonb,'{"might":2,"finesse":3,"vitality":5,"agility":3,"intellect":9,"resolve":9}'::jsonb,array['intellect','resolve']::text[],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('tidecaller',1,'Tidecaller','Combine cleansing and restoration with movement control. Focus: Intellect and Resolve.',true,true,1);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.bastion.last-bastion',1,'bastion','essence.bastion.last-bastion',1,'Last Bastion','Recover and fortify yourself, sacrificing damage dealt for strong protection.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.ravager.red-tempest',1,'ravager','essence.ravager.red-tempest',1,'Red Tempest','Strike nearby enemies and open bleeding wounds. Spacing limits the sweep.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.edgedancer.sevenfold-cut',1,'edgedancer','essence.edgedancer.sevenfold-cut',1,'Sevenfold Cut','Seven small cuts reward an opening; defenses resolve separately for every hit.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.wildwarden.apex-hunt',1,'wildwarden','essence.wildwarden.apex-hunt',1,'Apex Hunt','Strike and root your quarry at range, preparing an approach or retreat.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.runeblade.runic-overdrive',1,'runeblade','essence.runeblade.runic-overdrive',1,'Runic Overdrive','Cut a mystic line through enemies and restore your MP.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.dawnshield.dawns-oath',1,'dawnshield','essence.dawnshield.dawns-oath',1,'Dawn’s Oath','Cleanse, heal and guard a nearby ally. Separation can deny the rescue.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.cinderweaver.phoenix-wake',1,'cinderweaver','essence.cinderweaver.phoenix-wake',1,'Phoenix Wake','Burn enemies in an immediate fiery burst. Spread out to limit its impact.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.frostweaver.absolute-winter',1,'frostweaver','essence.frostweaver.absolute-winter',1,'Absolute Winter','Freeze enemies in a small area, denying movement while leaving their Skills available.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.stormsinger.skybreak',1,'stormsinger','essence.stormsinger.skybreak',1,'Skybreak','Send a powerful lightning strike down a long line; break sight or leave the lane.',true);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.tidecaller.tidal-crown',1,'tidecaller','essence.tidecaller.tidal-crown',1,'Tidal Crown','Cleanse and restore allies in a small area, then regenerate their HP.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values
('resonance.bastion-vanguard.linked-sequence',1,'bastion','vanguard','Tempered Vanguard','Bastion defensive Skill sets up the next Vanguard attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.bastion-lifebinder.linked-sequence',1,'bastion','lifebinder','Tempered Bloom','Bastion defensive Skill sets up the next Lifebinder attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.aetherist-bastion.linked-sequence',1,'aetherist','bastion','Tempered Arc','Bastion defensive Skill sets up the next Aetherist attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.bastion-farstrider.linked-sequence',1,'bastion','farstrider','Tempered Volley','Bastion defensive Skill sets up the next Farstrider attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.bastion-shadehand.linked-sequence',1,'bastion','shadehand','Tempered Ambush','Bastion defensive Skill sets up the next Shadehand attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.bastion-ironfist.linked-sequence',1,'bastion','ironfist','Tempered Impact','Bastion defensive Skill sets up the next Ironfist attack to grant the attacker Guarded. The setup is consumed by the payoff.',true),
('resonance.ravager-vanguard.linked-sequence',1,'ravager','vanguard','Crimson Vanguard','Ravager bleeding attack sets up the next Vanguard attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.lifebinder-ravager.linked-sequence',1,'lifebinder','ravager','Crimson Bloom','Ravager bleeding attack sets up the next Lifebinder attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.aetherist-ravager.linked-sequence',1,'aetherist','ravager','Crimson Arc','Ravager bleeding attack sets up the next Aetherist attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.farstrider-ravager.linked-sequence',1,'farstrider','ravager','Crimson Volley','Ravager bleeding attack sets up the next Farstrider attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ravager-shadehand.linked-sequence',1,'ravager','shadehand','Crimson Ambush','Ravager bleeding attack sets up the next Shadehand attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ironfist-ravager.linked-sequence',1,'ironfist','ravager','Crimson Impact','Ravager bleeding attack sets up the next Ironfist attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.bastion-ravager.linked-sequence',1,'bastion','ravager','Crimson Bulwark','Ravager bleeding attack sets up the next Bastion attack to restore up to 4 HP to the attacker. The setup is consumed by the payoff.',true),
('resonance.edgedancer-vanguard.linked-sequence',1,'edgedancer','vanguard','Poised Vanguard','Edgedancer exposure Skill sets up the next Vanguard attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-lifebinder.linked-sequence',1,'edgedancer','lifebinder','Poised Bloom','Edgedancer exposure Skill sets up the next Lifebinder attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.aetherist-edgedancer.linked-sequence',1,'aetherist','edgedancer','Poised Arc','Edgedancer exposure Skill sets up the next Aetherist attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-farstrider.linked-sequence',1,'edgedancer','farstrider','Poised Volley','Edgedancer exposure Skill sets up the next Farstrider attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-shadehand.linked-sequence',1,'edgedancer','shadehand','Poised Ambush','Edgedancer exposure Skill sets up the next Shadehand attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-ironfist.linked-sequence',1,'edgedancer','ironfist','Poised Impact','Edgedancer exposure Skill sets up the next Ironfist attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.bastion-edgedancer.linked-sequence',1,'bastion','edgedancer','Poised Bulwark','Edgedancer exposure Skill sets up the next Bastion attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-ravager.linked-sequence',1,'edgedancer','ravager','Poised Fury','Edgedancer exposure Skill sets up the next Ravager attack to Slow the selected enemy. The setup is consumed by the payoff.',true),
('resonance.vanguard-wildwarden.linked-sequence',1,'vanguard','wildwarden','Quarry Vanguard','Wildwarden mark sets up the next Vanguard attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.lifebinder-wildwarden.linked-sequence',1,'lifebinder','wildwarden','Quarry Bloom','Wildwarden mark sets up the next Lifebinder attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.aetherist-wildwarden.linked-sequence',1,'aetherist','wildwarden','Quarry Arc','Wildwarden mark sets up the next Aetherist attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.farstrider-wildwarden.linked-sequence',1,'farstrider','wildwarden','Quarry Volley','Wildwarden mark sets up the next Farstrider attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.shadehand-wildwarden.linked-sequence',1,'shadehand','wildwarden','Quarry Ambush','Wildwarden mark sets up the next Shadehand attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ironfist-wildwarden.linked-sequence',1,'ironfist','wildwarden','Quarry Impact','Wildwarden mark sets up the next Ironfist attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.bastion-wildwarden.linked-sequence',1,'bastion','wildwarden','Quarry Bulwark','Wildwarden mark sets up the next Bastion attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ravager-wildwarden.linked-sequence',1,'ravager','wildwarden','Quarry Fury','Wildwarden mark sets up the next Ravager attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.edgedancer-wildwarden.linked-sequence',1,'edgedancer','wildwarden','Quarry Edge','Wildwarden mark sets up the next Edgedancer attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.runeblade-vanguard.linked-sequence',1,'runeblade','vanguard','Runic Vanguard','Runeblade MP-draining attack sets up the next Vanguard attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.lifebinder-runeblade.linked-sequence',1,'lifebinder','runeblade','Runic Bloom','Runeblade MP-draining attack sets up the next Lifebinder attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.aetherist-runeblade.linked-sequence',1,'aetherist','runeblade','Runic Arc','Runeblade MP-draining attack sets up the next Aetherist attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.farstrider-runeblade.linked-sequence',1,'farstrider','runeblade','Runic Volley','Runeblade MP-draining attack sets up the next Farstrider attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.runeblade-shadehand.linked-sequence',1,'runeblade','shadehand','Runic Ambush','Runeblade MP-draining attack sets up the next Shadehand attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.ironfist-runeblade.linked-sequence',1,'ironfist','runeblade','Runic Impact','Runeblade MP-draining attack sets up the next Ironfist attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.bastion-runeblade.linked-sequence',1,'bastion','runeblade','Runic Bulwark','Runeblade MP-draining attack sets up the next Bastion attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.ravager-runeblade.linked-sequence',1,'ravager','runeblade','Runic Fury','Runeblade MP-draining attack sets up the next Ravager attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-runeblade.linked-sequence',1,'edgedancer','runeblade','Runic Edge','Runeblade MP-draining attack sets up the next Edgedancer attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.runeblade-wildwarden.linked-sequence',1,'runeblade','wildwarden','Runic Hunt','Runeblade MP-draining attack sets up the next Wildwarden attack to Expose the selected enemy. The setup is consumed by the payoff.',true),
('resonance.dawnshield-vanguard.linked-sequence',1,'dawnshield','vanguard','Dawnlit Vanguard','Dawnshield healing Skill sets up the next Vanguard attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-lifebinder.linked-sequence',1,'dawnshield','lifebinder','Dawnlit Bloom','Dawnshield healing Skill sets up the next Lifebinder attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.aetherist-dawnshield.linked-sequence',1,'aetherist','dawnshield','Dawnlit Arc','Dawnshield healing Skill sets up the next Aetherist attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-farstrider.linked-sequence',1,'dawnshield','farstrider','Dawnlit Volley','Dawnshield healing Skill sets up the next Farstrider attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-shadehand.linked-sequence',1,'dawnshield','shadehand','Dawnlit Ambush','Dawnshield healing Skill sets up the next Shadehand attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-ironfist.linked-sequence',1,'dawnshield','ironfist','Dawnlit Impact','Dawnshield healing Skill sets up the next Ironfist attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.bastion-dawnshield.linked-sequence',1,'bastion','dawnshield','Dawnlit Bulwark','Dawnshield healing Skill sets up the next Bastion attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-ravager.linked-sequence',1,'dawnshield','ravager','Dawnlit Fury','Dawnshield healing Skill sets up the next Ravager attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-edgedancer.linked-sequence',1,'dawnshield','edgedancer','Dawnlit Edge','Dawnshield healing Skill sets up the next Edgedancer attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-wildwarden.linked-sequence',1,'dawnshield','wildwarden','Dawnlit Hunt','Dawnshield healing Skill sets up the next Wildwarden attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-runeblade.linked-sequence',1,'dawnshield','runeblade','Dawnlit Sigil','Dawnshield healing Skill sets up the next Runeblade attack to cleanse Burn, Bleed and Poison from the attacker. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-vanguard.linked-sequence',1,'cinderweaver','vanguard','Ember Vanguard','Cinderweaver Burn Skill sets up the next Vanguard attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-lifebinder.linked-sequence',1,'cinderweaver','lifebinder','Ember Bloom','Cinderweaver Burn Skill sets up the next Lifebinder attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.aetherist-cinderweaver.linked-sequence',1,'aetherist','cinderweaver','Ember Arc','Cinderweaver Burn Skill sets up the next Aetherist attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-farstrider.linked-sequence',1,'cinderweaver','farstrider','Ember Volley','Cinderweaver Burn Skill sets up the next Farstrider attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-shadehand.linked-sequence',1,'cinderweaver','shadehand','Ember Ambush','Cinderweaver Burn Skill sets up the next Shadehand attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-ironfist.linked-sequence',1,'cinderweaver','ironfist','Ember Impact','Cinderweaver Burn Skill sets up the next Ironfist attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.bastion-cinderweaver.linked-sequence',1,'bastion','cinderweaver','Ember Bulwark','Cinderweaver Burn Skill sets up the next Bastion attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-ravager.linked-sequence',1,'cinderweaver','ravager','Ember Fury','Cinderweaver Burn Skill sets up the next Ravager attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-edgedancer.linked-sequence',1,'cinderweaver','edgedancer','Ember Edge','Cinderweaver Burn Skill sets up the next Edgedancer attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-wildwarden.linked-sequence',1,'cinderweaver','wildwarden','Ember Hunt','Cinderweaver Burn Skill sets up the next Wildwarden attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-runeblade.linked-sequence',1,'cinderweaver','runeblade','Ember Sigil','Cinderweaver Burn Skill sets up the next Runeblade attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-dawnshield.linked-sequence',1,'cinderweaver','dawnshield','Ember Aegis','Cinderweaver Burn Skill sets up the next Dawnshield attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-vanguard.linked-sequence',1,'frostweaver','vanguard','Frozen Vanguard','Frostweaver movement-control Skill sets up the next Vanguard attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-lifebinder.linked-sequence',1,'frostweaver','lifebinder','Frozen Bloom','Frostweaver movement-control Skill sets up the next Lifebinder attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.aetherist-frostweaver.linked-sequence',1,'aetherist','frostweaver','Frozen Arc','Frostweaver movement-control Skill sets up the next Aetherist attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.farstrider-frostweaver.linked-sequence',1,'farstrider','frostweaver','Frozen Volley','Frostweaver movement-control Skill sets up the next Farstrider attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-shadehand.linked-sequence',1,'frostweaver','shadehand','Frozen Ambush','Frostweaver movement-control Skill sets up the next Shadehand attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-ironfist.linked-sequence',1,'frostweaver','ironfist','Frozen Impact','Frostweaver movement-control Skill sets up the next Ironfist attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.bastion-frostweaver.linked-sequence',1,'bastion','frostweaver','Frozen Bulwark','Frostweaver movement-control Skill sets up the next Bastion attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-ravager.linked-sequence',1,'frostweaver','ravager','Frozen Fury','Frostweaver movement-control Skill sets up the next Ravager attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.edgedancer-frostweaver.linked-sequence',1,'edgedancer','frostweaver','Frozen Edge','Frostweaver movement-control Skill sets up the next Edgedancer attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-wildwarden.linked-sequence',1,'frostweaver','wildwarden','Frozen Hunt','Frostweaver movement-control Skill sets up the next Wildwarden attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.frostweaver-runeblade.linked-sequence',1,'frostweaver','runeblade','Frozen Sigil','Frostweaver movement-control Skill sets up the next Runeblade attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.dawnshield-frostweaver.linked-sequence',1,'dawnshield','frostweaver','Frozen Aegis','Frostweaver movement-control Skill sets up the next Dawnshield attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-frostweaver.linked-sequence',1,'cinderweaver','frostweaver','Frozen Flare','Frostweaver movement-control Skill sets up the next Cinderweaver attack to deal 4 additional base damage to the selected enemy. The setup is consumed by the payoff.',true),
('resonance.stormsinger-vanguard.linked-sequence',1,'stormsinger','vanguard','Charged Vanguard','Stormsinger MP-draining attack sets up the next Vanguard attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.lifebinder-stormsinger.linked-sequence',1,'lifebinder','stormsinger','Charged Bloom','Stormsinger MP-draining attack sets up the next Lifebinder attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.aetherist-stormsinger.linked-sequence',1,'aetherist','stormsinger','Charged Arc','Stormsinger MP-draining attack sets up the next Aetherist attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.farstrider-stormsinger.linked-sequence',1,'farstrider','stormsinger','Charged Volley','Stormsinger MP-draining attack sets up the next Farstrider attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.shadehand-stormsinger.linked-sequence',1,'shadehand','stormsinger','Charged Ambush','Stormsinger MP-draining attack sets up the next Shadehand attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ironfist-stormsinger.linked-sequence',1,'ironfist','stormsinger','Charged Impact','Stormsinger MP-draining attack sets up the next Ironfist attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.bastion-stormsinger.linked-sequence',1,'bastion','stormsinger','Charged Bulwark','Stormsinger MP-draining attack sets up the next Bastion attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.ravager-stormsinger.linked-sequence',1,'ravager','stormsinger','Charged Fury','Stormsinger MP-draining attack sets up the next Ravager attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.edgedancer-stormsinger.linked-sequence',1,'edgedancer','stormsinger','Charged Edge','Stormsinger MP-draining attack sets up the next Edgedancer attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.stormsinger-wildwarden.linked-sequence',1,'stormsinger','wildwarden','Charged Hunt','Stormsinger MP-draining attack sets up the next Wildwarden attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.runeblade-stormsinger.linked-sequence',1,'runeblade','stormsinger','Charged Sigil','Stormsinger MP-draining attack sets up the next Runeblade attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.dawnshield-stormsinger.linked-sequence',1,'dawnshield','stormsinger','Charged Aegis','Stormsinger MP-draining attack sets up the next Dawnshield attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-stormsinger.linked-sequence',1,'cinderweaver','stormsinger','Charged Flare','Stormsinger MP-draining attack sets up the next Cinderweaver attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.frostweaver-stormsinger.linked-sequence',1,'frostweaver','stormsinger','Charged Crystal','Stormsinger MP-draining attack sets up the next Frostweaver attack to restore up to 4 MP to the attacker. The setup is consumed by the payoff.',true),
('resonance.tidecaller-vanguard.linked-sequence',1,'tidecaller','vanguard','Renewing Vanguard','Tidecaller healing Skill sets up the next Vanguard attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.lifebinder-tidecaller.linked-sequence',1,'lifebinder','tidecaller','Renewing Bloom','Tidecaller healing Skill sets up the next Lifebinder attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.aetherist-tidecaller.linked-sequence',1,'aetherist','tidecaller','Renewing Arc','Tidecaller healing Skill sets up the next Aetherist attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.farstrider-tidecaller.linked-sequence',1,'farstrider','tidecaller','Renewing Volley','Tidecaller healing Skill sets up the next Farstrider attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.shadehand-tidecaller.linked-sequence',1,'shadehand','tidecaller','Renewing Ambush','Tidecaller healing Skill sets up the next Shadehand attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.ironfist-tidecaller.linked-sequence',1,'ironfist','tidecaller','Renewing Impact','Tidecaller healing Skill sets up the next Ironfist attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.bastion-tidecaller.linked-sequence',1,'bastion','tidecaller','Renewing Bulwark','Tidecaller healing Skill sets up the next Bastion attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.ravager-tidecaller.linked-sequence',1,'ravager','tidecaller','Renewing Fury','Tidecaller healing Skill sets up the next Ravager attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.edgedancer-tidecaller.linked-sequence',1,'edgedancer','tidecaller','Renewing Edge','Tidecaller healing Skill sets up the next Edgedancer attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.tidecaller-wildwarden.linked-sequence',1,'tidecaller','wildwarden','Renewing Hunt','Tidecaller healing Skill sets up the next Wildwarden attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.runeblade-tidecaller.linked-sequence',1,'runeblade','tidecaller','Renewing Sigil','Tidecaller healing Skill sets up the next Runeblade attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.dawnshield-tidecaller.linked-sequence',1,'dawnshield','tidecaller','Renewing Aegis','Tidecaller healing Skill sets up the next Dawnshield attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.cinderweaver-tidecaller.linked-sequence',1,'cinderweaver','tidecaller','Renewing Flare','Tidecaller healing Skill sets up the next Cinderweaver attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.frostweaver-tidecaller.linked-sequence',1,'frostweaver','tidecaller','Renewing Crystal','Tidecaller healing Skill sets up the next Frostweaver attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true),
('resonance.stormsinger-tidecaller.linked-sequence',1,'stormsinger','tidecaller','Renewing Thunder','Tidecaller healing Skill sets up the next Stormsinger attack to grant the attacker Regeneration. The setup is consumed by the payoff.',true);

create table app_private.discipline_mastery_prerequisites (
 discipline_id text not null, required_discipline_id text not null, minimum_stage integer not null check (minimum_stage between 1 and 5), primary key (discipline_id,required_discipline_id)
);
create table app_private.character_discipline_progress (
 character_id uuid not null references public.characters(id) on delete cascade,
 discipline_id text not null,
 mastery_xp integer not null default 0 check (mastery_xp between 0 and 1000),
 demonstrated_skills text[] not null default '{}',
 updated_at timestamptz not null default clock_timestamp(),
 primary key (character_id,discipline_id)
);
create table app_private.phase4_skill_catalog (
 skill_id text primary key, content_version integer not null, discipline_id text not null, minimum_stage integer not null check (minimum_stage between 1 and 5)
);
create table app_private.discipline_trial_claims (
 battle_session_id uuid primary key references app_private.battle_sessions(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade, discipline_id text not null,
 awarded_xp integer not null check (awarded_xp between 0 and 50), mastery_xp_after integer not null check (mastery_xp_after between 0 and 1000),
 claimed_at timestamptz not null default clock_timestamp()
);
create index discipline_trial_claims_character_idx on app_private.discipline_trial_claims(character_id);
revoke all on app_private.discipline_mastery_prerequisites, app_private.character_discipline_progress, app_private.phase4_skill_catalog, app_private.discipline_trial_claims from public, anon, authenticated;
grant select on app_private.discipline_mastery_prerequisites, app_private.character_discipline_progress, app_private.phase4_skill_catalog, app_private.discipline_trial_claims to service_role;


insert into app_private.discipline_mastery_prerequisites values
('bastion','vanguard',3),
('ravager','vanguard',3),
('edgedancer','vanguard',2),
('edgedancer','shadehand',2),
('wildwarden','farstrider',3),
('runeblade','vanguard',2),
('runeblade','aetherist',2),
('dawnshield','vanguard',3),
('dawnshield','lifebinder',3),
('cinderweaver','aetherist',2),
('frostweaver','aetherist',2),
('stormsinger','aetherist',2),
('stormsinger','farstrider',1),
('tidecaller','aetherist',2),
('tidecaller','lifebinder',1);

insert into app_private.phase4_skill_catalog values
('bastion.shield-bash',1,'bastion',1),
('bastion.cover',1,'bastion',1),
('bastion.challenge',1,'bastion',1),
('bastion.fortress',1,'bastion',1),
('bastion.hold-fast',1,'bastion',2),
('bastion.shield-line',1,'bastion',2),
('bastion.stalwart-strike',1,'bastion',3),
('bastion.steady-footing',1,'bastion',3),
('ravager.frenzy',1,'ravager',1),
('ravager.gash',1,'ravager',1),
('ravager.cleaving-blow',1,'ravager',1),
('ravager.blood-rush',1,'ravager',1),
('ravager.war-roar',1,'ravager',2),
('ravager.desperate-execution',1,'ravager',2),
('ravager.blood-siphon',1,'ravager',3),
('ravager.open-wound',1,'ravager',3),
('edgedancer.lunge',1,'edgedancer',1),
('edgedancer.riposte',1,'edgedancer',1),
('edgedancer.hamstring',1,'edgedancer',1),
('edgedancer.flourish',1,'edgedancer',1),
('edgedancer.poised-guard',1,'edgedancer',2),
('edgedancer.flanking-cut',1,'edgedancer',2),
('edgedancer.severing-cut',1,'edgedancer',3),
('edgedancer.finishing-thrust',1,'edgedancer',3),
('wildwarden.snare',1,'wildwarden',1),
('wildwarden.hunters-mark',1,'wildwarden',1),
('wildwarden.venom-shot',1,'wildwarden',1),
('wildwarden.field-remedy',1,'wildwarden',1),
('wildwarden.thorn-line',1,'wildwarden',2),
('wildwarden.pursuit-shot',1,'wildwarden',2),
('wildwarden.renewing-herbs',1,'wildwarden',3),
('wildwarden.close-quarry',1,'wildwarden',3),
('runeblade.arc-edge',1,'runeblade',1),
('runeblade.rune-guard',1,'runeblade',1),
('runeblade.siphon-slash',1,'runeblade',1),
('runeblade.sigil-brand',1,'runeblade',1),
('runeblade.rune-burst',1,'runeblade',2),
('runeblade.unbinding-rune',1,'runeblade',2),
('runeblade.aether-cut',1,'runeblade',3),
('runeblade.rune-mending',1,'runeblade',3),
('dawnshield.radiant-strike',1,'dawnshield',1),
('dawnshield.sacred-guard',1,'dawnshield',1),
('dawnshield.purge',1,'dawnshield',1),
('dawnshield.consecrated-light',1,'dawnshield',1),
('dawnshield.aegis',1,'dawnshield',2),
('dawnshield.renewal',1,'dawnshield',2),
('dawnshield.judgment',1,'dawnshield',3),
('dawnshield.last-light',1,'dawnshield',3),
('cinderweaver.cinder-bolt',1,'cinderweaver',1),
('cinderweaver.flame-burst',1,'cinderweaver',1),
('cinderweaver.ember-line',1,'cinderweaver',1),
('cinderweaver.scorch',1,'cinderweaver',1),
('cinderweaver.ash-ward',1,'cinderweaver',2),
('cinderweaver.flashfire',1,'cinderweaver',2),
('cinderweaver.banked-embers',1,'cinderweaver',3),
('cinderweaver.blistering-heat',1,'cinderweaver',3),
('frostweaver.ice-lance',1,'frostweaver',1),
('frostweaver.frost-guard',1,'frostweaver',1),
('frostweaver.chilling-mist',1,'frostweaver',1),
('frostweaver.crystal-prison',1,'frostweaver',1),
('frostweaver.shatter',1,'frostweaver',2),
('frostweaver.ice-line',1,'frostweaver',2),
('frostweaver.thaw',1,'frostweaver',3),
('frostweaver.brittle-ice',1,'frostweaver',3),
('stormsinger.arc-spark',1,'stormsinger',1),
('stormsinger.lightning-line',1,'stormsinger',1),
('stormsinger.static-burst',1,'stormsinger',1),
('stormsinger.thunderclap',1,'stormsinger',1),
('stormsinger.grounding',1,'stormsinger',2),
('stormsinger.static-drain',1,'stormsinger',2),
('stormsinger.conductive-bolt',1,'stormsinger',3),
('stormsinger.storm-breath',1,'stormsinger',3),
('tidecaller.water-lance',1,'tidecaller',1),
('tidecaller.mist-veil',1,'tidecaller',1),
('tidecaller.undertow',1,'tidecaller',1),
('tidecaller.cleansing-rain',1,'tidecaller',1),
('tidecaller.flood-line',1,'tidecaller',2),
('tidecaller.springwater',1,'tidecaller',2),
('tidecaller.still-water',1,'tidecaller',3),
('tidecaller.crushing-wave',1,'tidecaller',3);

create function app_private.discipline_mastery_stage_v1(p_character_id uuid, p_discipline_id text)
returns integer language sql stable security definer set search_path = pg_catalog, public, app_private as $$
 select case when exists(select 1 from app_private.character_discipline_masteries where character_id=p_character_id and discipline_id=p_discipline_id) then 5
 else coalesce((select case when mastery_xp>=1000 then 5 when mastery_xp>=600 then 4 when mastery_xp>=300 then 3 when mastery_xp>=100 then 2 else 1 end from app_private.character_discipline_progress where character_id=p_character_id and discipline_id=p_discipline_id),1) end;
$$;
create function app_private.discipline_unlocked_v1(p_character_id uuid, p_discipline_id text)
returns boolean language sql stable security definer set search_path = pg_catalog, public, app_private as $$
 select not exists(select 1 from app_private.discipline_mastery_prerequisites requirement where requirement.discipline_id=p_discipline_id and app_private.discipline_mastery_stage_v1(p_character_id,requirement.required_discipline_id)<requirement.minimum_stage);
$$;
create function app_private.provision_mastery_skills_v1(p_character_id uuid)
returns void language sql security definer set search_path = pg_catalog, public, app_private as $$
 insert into app_private.character_skill_unlocks (character_id,skill_id,skill_content_version,source_discipline_id,learned_at,source_kind,source_id)
 select p_character_id,catalog.skill_id,catalog.content_version,catalog.discipline_id,statement_timestamp(),'gameplay','discipline-mastery:v1'
 from app_private.phase4_skill_catalog catalog
 join app_private.character_active_builds build on build.character_id=p_character_id and (catalog.discipline_id=build.primary_discipline_id or catalog.discipline_id=build.secondary_discipline_id)
 where app_private.discipline_unlocked_v1(p_character_id,catalog.discipline_id)
 and app_private.discipline_mastery_stage_v1(p_character_id,catalog.discipline_id)>=catalog.minimum_stage
 on conflict(character_id,skill_id) do nothing;
$$;
create function app_private.enforce_phase4_acquisition_v1()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
begin
 if not app_private.discipline_unlocked_v1(new.character_id,new.primary_discipline_id) then raise exception using errcode='22023',message='PRIMARY_DISCIPLINE_MASTERY_REQUIRED'; end if;
 return new;
end;
$$;
create trigger enforce_phase4_acquisition before insert or update of primary_discipline_id on app_private.character_active_builds for each row execute function app_private.enforce_phase4_acquisition_v1();
create function app_private.provision_phase4_active_build_v1()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
begin
 insert into app_private.character_discipline_progress(character_id,discipline_id) values(new.character_id,new.primary_discipline_id) on conflict do nothing;
 perform app_private.provision_mastery_skills_v1(new.character_id);
 return new;
end;
$$;
create trigger provision_phase4_active_build after insert or update of primary_discipline_id,secondary_discipline_id on app_private.character_active_builds for each row execute function app_private.provision_phase4_active_build_v1();
insert into app_private.character_discipline_progress(character_id,discipline_id) select character_id,primary_discipline_id from app_private.character_active_builds on conflict do nothing;
insert into app_private.character_discipline_progress(character_id,discipline_id,mastery_xp) select character_id,discipline_id,1000 from app_private.character_discipline_masteries on conflict(character_id,discipline_id) do update set mastery_xp=1000;

create or replace function public.get_character_discipline_catalog_v2(p_user_id uuid,p_character_id uuid)
returns table(discipline_id text,definition_version integer,name text,summary text,enabled_for_primary boolean,enabled_for_secondary boolean,profile_version integer,stat_offsets jsonb,mastered_at timestamptz)
language sql security definer stable set search_path = pg_catalog, public, app_private as $$
 with latest as (select distinct on (definition.discipline_id) definition.* from app_private.discipline_definitions definition where definition.enabled_for_primary or definition.enabled_for_secondary order by definition.discipline_id,definition.definition_version desc)
 select definition.discipline_id,definition.definition_version,definition.name,definition.summary,
 definition.enabled_for_primary and app_private.discipline_unlocked_v1(p_character_id,definition.discipline_id),definition.enabled_for_secondary,
 profile.profile_version,profile.stat_offsets,mastery.mastered_at
 from latest definition join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version
 left join app_private.character_discipline_masteries mastery on mastery.character_id=p_character_id and mastery.discipline_id=definition.discipline_id
 where exists(select 1 from public.characters where id=p_character_id and user_id=p_user_id) order by definition.name,definition.discipline_id;
$$;

create function public.get_character_discipline_progress_v1(p_user_id uuid,p_character_id uuid)
returns table(discipline_id text,mastery_xp integer,stage integer,unlocked boolean,demonstrated_skill_count integer)
language sql security definer stable set search_path = pg_catalog, public, app_private as $$
 select definition.discipline_id,case when app_private.discipline_mastery_stage_v1(p_character_id,definition.discipline_id)=5 then 1000 else coalesce(progress.mastery_xp,0) end,app_private.discipline_mastery_stage_v1(p_character_id,definition.discipline_id),app_private.discipline_unlocked_v1(p_character_id,definition.discipline_id),coalesce(cardinality(progress.demonstrated_skills),0)
 from (select distinct discipline_id from app_private.discipline_definitions where enabled_for_primary) definition
 left join app_private.character_discipline_progress progress on progress.character_id=p_character_id and progress.discipline_id=definition.discipline_id
 where exists(select 1 from public.characters where id=p_character_id and user_id=p_user_id) order by definition.discipline_id;
$$;

create function public.claim_discipline_trial_v1(p_user_id uuid,p_battle_session_id uuid)
returns table(discipline_id text,awarded_xp integer,mastery_xp integer,stage integer,replayed boolean)
language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare
 v_session app_private.battle_sessions%rowtype;
 v_participant app_private.battle_participants%rowtype;
 v_initial jsonb;
 v_primary text;
 v_demonstrated text[];
 v_uses integer;
 v_before integer;
 v_after integer;
 v_claim app_private.discipline_trial_claims%rowtype;
 v_progress app_private.character_discipline_progress%rowtype;
begin
 select * into v_session from app_private.battle_sessions where id=p_battle_session_id and owner_user_id=p_user_id for update;
 if not found then raise exception using errcode='42501',message='TRIAL_NOT_FOUND'; end if;
 select * into v_participant from app_private.battle_participants where battle_session_id=p_battle_session_id and user_id=p_user_id and character_id is not null;
 if not found then raise exception using errcode='42501',message='TRIAL_NOT_FOUND'; end if;
 perform 1 from public.characters where id=v_participant.character_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='42501',message='TRIAL_NOT_FOUND'; end if;
 select * into v_claim from app_private.discipline_trial_claims where battle_session_id=p_battle_session_id;
 if found then return query select v_claim.discipline_id,v_claim.awarded_xp,v_claim.mastery_xp_after,app_private.discipline_mastery_stage_v1(v_participant.character_id,v_claim.discipline_id),true; return; end if;
 select snapshot into v_initial from app_private.battle_snapshots where battle_session_id=p_battle_session_id and battle_version=1;
 if not exists(select 1 from jsonb_array_elements(v_initial #> '{statBridge,combatants}') unit where unit #>> '{provenance,kind}'='scenario' and unit #>> '{provenance,sourceId}' ~ '^scenario:p2-7-recruit:[a-z-]+:mastery-trial:(standard|high)$') then raise exception using errcode='22023',message='MASTERY_TRIAL_REQUIRED'; end if;
 if v_session.lifecycle<>'completed' or not exists(select 1 from jsonb_array_elements(v_session.current_snapshot #> '{tactical,battle,combatants}') unit where unit->>'id'=v_participant.combatant_id and (unit->>'hp')::integer>0)
 or exists(select 1 from jsonb_array_elements(v_session.current_snapshot #> '{tactical,battle,combatants}') unit where unit->>'teamId'<>'players' and (unit->>'hp')::integer>0)
 then raise exception using errcode='22023',message='TRIAL_VICTORY_REQUIRED'; end if;
 if exists(select 1 from app_private.battle_events where battle_session_id=p_battle_session_id and event->>'combatantId'=v_participant.combatant_id and event->>'event' in ('ai_turn_timed_out','pvp_turn_timed_out')) then raise exception using errcode='22023',message='TRIAL_TIMEOUT_DISQUALIFIED'; end if;
 select unit #>> '{primary,disciplineId}' into v_primary from jsonb_array_elements(v_initial #> '{buildAuthority,combatants}') unit where unit->>'combatantId'=v_participant.combatant_id;
 if v_primary is null then raise exception using errcode='22023',message='TRIAL_COMMITTED_BUILD_REQUIRED'; end if;
 select array_agg(distinct catalog.skill_id),count(*)::integer into v_demonstrated,v_uses
 from app_private.battle_events history join app_private.phase4_skill_catalog catalog on catalog.skill_id=history.event->>'actionId' and catalog.discipline_id=v_primary
 where history.battle_session_id=p_battle_session_id and history.event->>'event'='combat_action_used' and history.event->>'actorId'=v_participant.combatant_id;
 if coalesce(cardinality(v_demonstrated),0)<2 or v_uses<3 then raise exception using errcode='22023',message='TRIAL_SKILL_VARIETY_REQUIRED'; end if;
 insert into app_private.character_discipline_progress(character_id,discipline_id) values(v_participant.character_id,v_primary) on conflict do nothing;
 select * into v_progress from app_private.character_discipline_progress where character_id=v_participant.character_id and character_discipline_progress.discipline_id=v_primary for update;
 v_before:=v_progress.mastery_xp;
 select array_agg(distinct id order by id) into v_demonstrated from unnest(v_demonstrated || v_progress.demonstrated_skills) id;
 v_after:=least(case when cardinality(v_demonstrated)>=8 then 1000 else 999 end,v_before+50);
 -- Existing Owner/system mastery facts remain authoritative.
 if app_private.discipline_mastery_stage_v1(v_participant.character_id,v_primary)=5 then v_after:=1000; end if;
 update app_private.character_discipline_progress set mastery_xp=v_after,demonstrated_skills=v_demonstrated,updated_at=clock_timestamp() where character_id=v_participant.character_id and character_discipline_progress.discipline_id=v_primary;
 if v_after=1000 then perform public.record_character_discipline_mastery_v1(v_participant.character_id,v_primary,'gameplay','discipline-trial:'||p_battle_session_id::text); end if;
 perform app_private.provision_mastery_skills_v1(v_participant.character_id);
 insert into app_private.discipline_trial_claims values(p_battle_session_id,v_participant.character_id,v_primary,v_after-v_before,v_after,clock_timestamp());
 return query select v_primary,v_after-v_before,v_after,app_private.discipline_mastery_stage_v1(v_participant.character_id,v_primary),false;
end;
$$;
revoke all on function app_private.discipline_mastery_stage_v1(uuid,text),app_private.discipline_unlocked_v1(uuid,text),app_private.provision_mastery_skills_v1(uuid),app_private.enforce_phase4_acquisition_v1(),app_private.provision_phase4_active_build_v1() from public,anon,authenticated;
revoke all on function public.get_character_discipline_progress_v1(uuid,uuid),public.claim_discipline_trial_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_character_discipline_progress_v1(uuid,uuid),public.claim_discipline_trial_v1(uuid,uuid) to service_role;

insert into app_private.phase4_skill_catalog values
('vanguard.forceful-strike',2,'vanguard',1),
('vanguard.cleave',1,'vanguard',1),
('vanguard.guard-break',1,'vanguard',1),
('vanguard.brace',1,'vanguard',1),
('vanguard.rally',1,'vanguard',1),
('vanguard.shield-bash',1,'vanguard',1),
('vanguard.second-wind',1,'vanguard',1),
('vanguard.sweeping-strike',1,'vanguard',1),
('lifebinder.mending-light',1,'lifebinder',1),
('lifebinder.mend',1,'lifebinder',1),
('lifebinder.barrier',1,'lifebinder',1),
('lifebinder.renew',1,'lifebinder',1),
('lifebinder.sanctuary',1,'lifebinder',1),
('lifebinder.fortifying-light',1,'lifebinder',1),
('lifebinder.vital-sever',1,'lifebinder',1),
('lifebinder.searing-bloom',1,'lifebinder',1),
('aetherist.arc-bolt',1,'aetherist',1),
('aetherist.mana-burst',1,'aetherist',1),
('aetherist.ward-pierce',1,'aetherist',1),
('aetherist.arcane-field',1,'aetherist',1),
('aetherist.channel',1,'aetherist',1),
('aetherist.mana-shield',1,'aetherist',1),
('aetherist.chain-spark',1,'aetherist',1),
('aetherist.overchannel',1,'aetherist',1),
('farstrider.aimed-shot',1,'farstrider',1),
('farstrider.pinning-shot',1,'farstrider',1),
('farstrider.volley',1,'farstrider',1),
('farstrider.scouts-mark',1,'farstrider',1),
('farstrider.longshot',1,'farstrider',1),
('farstrider.piercing-barrage',1,'farstrider',1),
('farstrider.fieldcraft',1,'farstrider',1),
('farstrider.keen-focus',1,'farstrider',1),
('shadehand.backstab',1,'shadehand',1),
('shadehand.feint',1,'shadehand',1),
('shadehand.smoke-vial',1,'shadehand',1),
('shadehand.crippling-cut',1,'shadehand',1),
('shadehand.exploit-opening',1,'shadehand',1),
('shadehand.fan-of-knives',1,'shadehand',1),
('shadehand.quick-hands',1,'shadehand',1),
('shadehand.execution-cut',1,'shadehand',1),
('ironfist.rising-fist',1,'ironfist',1),
('ironfist.sweep',1,'ironfist',1),
('ironfist.focus-breath',1,'ironfist',1),
('ironfist.counter-palm',1,'ironfist',1),
('ironfist.breakfall',1,'ironfist',1),
('ironfist.hammer-knuckle',1,'ironfist',1),
('ironfist.pressure-palm',1,'ironfist',1),
('ironfist.last-stand',1,'ironfist',1);

commit;
