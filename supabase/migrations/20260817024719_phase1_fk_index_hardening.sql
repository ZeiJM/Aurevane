begin;

create index if not exists character_xp_grants_curve_version_idx
  on app_private.character_xp_grants (curve_version);

create index if not exists progression_cycle_level_curves_curve_version_idx
  on app_private.progression_cycle_level_curves (curve_version);

create index if not exists training_report_claims_curve_version_idx
  on app_private.training_report_claims (curve_version);

create index if not exists training_report_claims_user_id_idx
  on app_private.training_report_claims (user_id);

create index if not exists training_report_claims_xp_grant_id_idx
  on app_private.training_report_claims (xp_grant_id);

create index if not exists training_reports_config_version_idx
  on app_private.training_reports (config_version);

create index if not exists wayfarers_practice_state_config_version_idx
  on app_private.wayfarers_practice_state (config_version);

commit;
