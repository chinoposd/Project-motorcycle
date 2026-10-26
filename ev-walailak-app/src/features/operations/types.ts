export interface OpsConfig {
  version:number;project_phone:string;project_ended_at:string|null;retention_cleanup_authorized:boolean;
  privacy_policy_reviewed_at:string|null;privacy_policy_reference:string;privacy_notice_version:string|null;terms_version:string|null;
  cancellation_window_hours:number|null;cancellation_warning_remaining:number|null;no_show_window_hours:number|null;no_show_warning_remaining:number|null;offline_alert_minutes:number|null;
}
export interface OpsAccount {id:string;name:string;role:string;status:string;driving_permission:boolean;induction_confirmed:boolean}
export interface Appeal {id:string;user_id:string;user_name?:string;details:string;status:string;decision_reason:string;version:number;created_at:string;reviewed_at:string|null}
export interface Card {id:string;user_id:string;user_name?:string;enabled:boolean;revoked_at:string|null;registered_at:string;version:number}
export interface VehicleState {vehicle_id:string;fresh:boolean|null;telemetry_at:string|null;valid_until:string|null;online:boolean|null;protocol_verified:boolean;offline_protocol_verified:boolean;stopped:boolean|null;bms_ok:boolean|null;ai_ready:boolean|null;gps_reliable:boolean|null;motor_ready:boolean|null;latitude:number|null;longitude:number|null;gps_at:string|null;battery_percent:number|null;offline_reconciliation_required:boolean;offline_manifest_version:number;offline_lease_until:string|null}
export interface OpsSession {id:string;user_id:string;status:string;source:string;command_id:string;created_at:string;expires_at:string;started_at:string|null;ended_at:string|null;distance_km:number|null;version:number;rider_name?:string;rider_role?:string;rider_phone?:string|null;end_reason?:string}
export interface OperationalAlert {id:string;kind:string;title:string;details:string;priority:number;opened_at:string;resolved_at:string|null;acknowledged_at:string|null;acknowledged_name:string|null}
export interface Cycle {id:string;user_id:string;user_name?:string;kind:'Cancellation'|'NoShow';count_value:number;restricted_until:string|null;release_pending:boolean;policy:{limit?:number|null;window_hours?:number|null;warning_remaining?:number|null}}
export interface BehaviorEvent {id:string;user_id:string;user_name?:string;kind:string;occurred_at:string;counted:boolean;fault_status:string;first_requested_at:string|null}
export interface BehaviorReview {id:string;event_id:string;decision:string;evidence:string;reason:string;created_at:string}
export interface Zone {kind:'main'|'return';version:number;active:boolean;geometry:{type:'Polygon';coordinates:number[][][]};reason:string;created_at:string}
export interface TripReport {id:string;session_id:string;user_name:string;details:string;status:string;created_at:string;trip:OpsSession}
export interface GpsReview {id:string;user_id:string;user_name?:string;status:string;start_restricted:boolean;reason:string;summary:string;version:number;called_at:string|null;created_at:string}
export interface ReturnCheck {id:string;user_id:string;session_id:string;checked_at:string;result:string;raw_deleted_at:string|null}
export interface PrivacyCase {id:string;requester_id:string|null;user_name:string|null;request_type:'access'|'correction'|'deletion';details:string;status:string;admin_note:string;version:number;identity_verified_at:string|null;identity_method:string;legal_basis:string;fulfillment_evidence:string;fulfilled_at:string|null;created_at:string}
export interface PrivacyJob {id:string;request_id:string|null;user_id:string|null;kind:string;status:string;last_error:string;attempts:number;completed_at:string|null;data_purged_at:string|null}
export interface PrivacyHold {id:string;user_id:string;reason:string;created_at:string;released_at:string|null}
export interface Inspection {id:string;session_id:string;user_name:string;source:string;confirmed_at:string}
export interface DailyReport {date:string;session_count:number;duration_missing:number;total_duration_seconds:number;average_duration_seconds:number|null;distance_missing:number;total_distance_km:number|null;average_distance_km:number|null;unique_users:number}
export interface ManifestSummary {version:number;issued_at:string;expires_at:string;key_id:string;invalidated_at:string|null}
export interface OperationsSnapshot {can_admin:boolean;config:OpsConfig;accounts:OpsAccount[];appeals:Appeal[];nfc_cards:Card[];vehicle:VehicleState;current_session:OpsSession|null;
  service:{manual_out_of_service:boolean;safety_block_active:boolean;final_confirmation_required:boolean;service_reason:string};
  alerts:OperationalAlert[];no_show_events:BehaviorEvent[];no_show_reviews:BehaviorReview[];cycles:Cycle[];inspections:Inspection[];issues:{id:string;category:string;details:string;high_risk:boolean;created_at:string}[];
  zones:Zone[];daily_report:DailyReport;trip_reports:TripReport[];gps_reviews:GpsReview[];return_checks:ReturnCheck[];privacy_requests:PrivacyCase[];privacy_jobs:PrivacyJob[];privacy_holds:PrivacyHold[];manifests:ManifestSummary[];
}
export interface UserNotice {id:string;kind:string;message:string;created_at:string;expires_at:string|null;acknowledgment_required:boolean;acknowledged_at:string|null}
export interface MyOperations {account:{id:string;name:string;phone:string;role:'Student'|'Employee'|'Manager'|'Admin';status:'Pending'|'Approved'|'Rejected'|'Suspended';account_status_reason:string;driving_permission:boolean;induction_confirmed:boolean};project_phone:string;appeals:Appeal[];nfc_card:Card|null;vehicle_availability:'available'|'unavailable'|'in_use'|'unknown'|null;session:OpsSession|null;
  own_vehicle:{latitude:number|null;longitude:number|null;gps_at:string|null;battery_percent:number|null;fresh:boolean}|null;
  trips:Pick<OpsSession,'id'|'started_at'|'ended_at'|'distance_km'>[];no_show_events:BehaviorEvent[];cycles:Cycle[];warnings:{kind:string;remaining:number}[];notices:UserNotice[];zones:Zone[];
  consent_versions:{privacy:string|null;terms:string|null;privacy_text?:string|null;terms_text?:string|null};
  gps_reviews:GpsReview[];trip_reports:TripReport[];privacy_exports:{id:string;request_id:string;data:unknown;created_at:string}[];
}
