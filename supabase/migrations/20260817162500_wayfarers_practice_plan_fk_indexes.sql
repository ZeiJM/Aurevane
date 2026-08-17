begin;

create index training_reports_planned_window_config_version_idx
  on app_private.training_reports (planned_window_config_version);

create index wayfarers_practice_state_planned_window_config_version_idx
  on app_private.wayfarers_practice_state (planned_window_config_version);

commit;
