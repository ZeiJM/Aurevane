begin;

-- Add Chronist without removing Tidecaller or rewriting immutable battle snapshots.

insert into app_private.discipline_primary_profiles (discipline_id,profile_version,stat_offsets,core_base_attributes,focus_attributes,off_focus_cap) values ('chronist',1,'{"maxMp":15,"initiative":2}'::jsonb,'{"might": 2, "finesse": 3, "vitality": 4, "agility": 5, "intellect": 10, "resolve": 7}'::jsonb,array['intellect','resolve'],30);

insert into app_private.discipline_definitions (discipline_id,definition_version,name,summary,enabled_for_primary,enabled_for_secondary,primary_profile_version) values ('chronist',1,'Chronist','Prepare next-round tempo, delay threats and recover footing. Focus: Intellect and Resolve.',true,true,1);

insert into app_private.discipline_mastery_prerequisites values ('chronist','aetherist',3);

insert into app_private.essence_definitions (essence_id,content_version,source_discipline_id,skill_id,skill_content_version,name,description,enabled) values ('essence.chronist.borrowed-hour',1,'chronist','essence.chronist.borrowed-hour',1,'Borrowed Hour','Restore an ally and prepare +40 Initiative for the next round. No extra turn, AP or battle reset.',true);

insert into app_private.phase4_skill_catalog values ('chronist.temporal-bolt',1,'chronist',1),('chronist.haste',1,'chronist',1),('chronist.slow',1,'chronist',1),('chronist.delay',1,'chronist',1),('chronist.rewind-step',1,'chronist',2),('chronist.time-lock',1,'chronist',2),('chronist.temporal-ward',1,'chronist',3),('chronist.stolen-moment',1,'chronist',3);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-vanguard.linked-sequence',1,'chronist','vanguard','Measured Vanguard','Chronist tempo Skill sets up the next Vanguard attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-lifebinder.linked-sequence',1,'chronist','lifebinder','Measured Bloom','Chronist tempo Skill sets up the next Lifebinder attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.aetherist-chronist.linked-sequence',1,'aetherist','chronist','Measured Arc','Chronist tempo Skill sets up the next Aetherist attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-farstrider.linked-sequence',1,'chronist','farstrider','Measured Volley','Chronist tempo Skill sets up the next Farstrider attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-shadehand.linked-sequence',1,'chronist','shadehand','Measured Ambush','Chronist tempo Skill sets up the next Shadehand attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-ironfist.linked-sequence',1,'chronist','ironfist','Measured Impact','Chronist tempo Skill sets up the next Ironfist attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.bastion-chronist.linked-sequence',1,'bastion','chronist','Measured Bulwark','Chronist tempo Skill sets up the next Bastion attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-ravager.linked-sequence',1,'chronist','ravager','Measured Fury','Chronist tempo Skill sets up the next Ravager attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-edgedancer.linked-sequence',1,'chronist','edgedancer','Measured Edge','Chronist tempo Skill sets up the next Edgedancer attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-wildwarden.linked-sequence',1,'chronist','wildwarden','Measured Hunt','Chronist tempo Skill sets up the next Wildwarden attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-runeblade.linked-sequence',1,'chronist','runeblade','Measured Sigil','Chronist tempo Skill sets up the next Runeblade attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-dawnshield.linked-sequence',1,'chronist','dawnshield','Measured Aegis','Chronist tempo Skill sets up the next Dawnshield attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-cinderweaver.linked-sequence',1,'chronist','cinderweaver','Measured Flare','Chronist tempo Skill sets up the next Cinderweaver attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-frostweaver.linked-sequence',1,'chronist','frostweaver','Measured Crystal','Chronist tempo Skill sets up the next Frostweaver attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-stormsinger.linked-sequence',1,'chronist','stormsinger','Measured Thunder','Chronist tempo Skill sets up the next Stormsinger attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

insert into app_private.resonance_definitions (resonance_id,content_version,discipline_a_id,discipline_b_id,name,description,enabled) values ('resonance.chronist-tidecaller.linked-sequence',1,'chronist','tidecaller','Measured Tide','Chronist tempo Skill sets up the next Tidecaller attack to grant the attacker Hastened for the next round. The setup is consumed by the payoff.',true);

commit;
