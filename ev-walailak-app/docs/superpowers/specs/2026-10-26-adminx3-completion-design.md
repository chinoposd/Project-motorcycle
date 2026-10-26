# Adminx3 — complete the documented web administration workflows

## Intent and existing decisions

The owner requests branch `Adminx3`, based on `develop` (`f9b4b5c`), and completion of the missing Admin features against the reconciled requirements and latest Handoff amendments. Preserve React/Vite, the current Thai visual language, Supabase Auth, authoritative profile roles, individual account approval, and audited RPC writes. The user and a teammate currently own the web/cloud portion; ESP32/Pi firmware and physical vehicle validation remain with the vehicle team.

## Approach

Extend the existing Supabase RPC architecture with explicit web operations, session/event records, and a gateway contract. This is the proposed approach because it supports shared Admin/Manager state and atomic audit records. Browser-only persistence cannot provide authoritative authorization or shared alerts. Replacing the app/platform would discard the existing account and portal work without meeting an additional requirement.

Use a grouped Admin workspace (overview, accounts/appeals, operations, zones/contact, privacy, existing announcements/settings/audit). Keep forms usable on mobile. Existing modules stay accessible; additions load independently so a missing new migration never removes the older account or portal tools. Show loading, failure, unavailable, and empty states distinctly. Do not present sample vehicle data in a real-account view.

## Deliverables and acceptance

### 1. Accounts and appeals — C-012, C-017, C-083–C-087

- Rejected/Suspended users can view their own reason, account details, guide/contact information, submit one open appeal with explanation, and see their appeal decisions. Pending accounts can see the allowed non-location vehicle availability and project/guide information. No Live GPS is exposed to Pending/Rejected/Suspended users.
- Admin sees the appeal queue and history; records a decision and reason with a status/version check to prevent stale reviews. Accepting reconsideration returns an account to Pending for the existing individual review; it never grants Driving Permission automatically. This restoration-to-Pending is an implementation proposal, not a new requirement from the document.
- Rejected/Suspended users cannot obtain new start authorization. Role changes, suspension, and permission revocation do not cut an active motor.

### 2. Real web Session authorization — C-002–C-005, C-015, C-020–C-031, C-110, C-116, C-129–C-144

- A server RPC reads the current profile, induction/Driving Permission, configured Bangkok weekdays/hours, independent restrictions, service blocks, required consent/inspection attestation, zone configuration and trusted vehicle readiness. Admin cannot drive. Student/Employee use identical policies. Manager is exempt from start hours, AI/Main Geofence and documented GPS/Return Zone limitations only, never basic safety or Driving Permission.
- Serialize reservations per vehicle and user; online reservation expiry is server-side and at most five minutes. Refresh does not extend expiry. User cancellation and timeout events are persisted. System/admin-caused unavailability does not increment user-fault counters.
- Authorization produces Reserved/PendingStart only. A trusted gateway must confirm actual Motor Ready with matching session/command IDs before Active. Browser RPCs cannot provide telemetry, spoof confirmations or mark a Session Active/Completed.
- Pause/Resume/End preserve ownership and require the documented trusted stopped/proximity/safety/return/motor confirmation. Uncertain results retain the pending state and block a second rider. Current active Sessions are not terminated because hours end or permissions change.
- Missing/unvalidated hardware evidence explicitly blocks authorization. The web code cannot manufacture a proximity or safety method that the requirements leave pending design/test.

### 3. Events, restrictions, Dashboard and shared operational alerts — C-050–C-057, C-123/Q25–Q69

- Use persistent session/reservation/issue events, independently versioned Cancellation/No-show evaluation cycles, immutable evaluations and stored cooldown expiry. Null Pilot parameters stay unset. Add nullable evaluation-window and near-warning settings; no invented operational defaults.
- New settings affect future evaluations only; existing cooldowns preserve their applied version and expiry. Expiry resets only that category. Show only applicable near-threshold warnings with remaining event counts; display both categories separately when needed.
- Share alert episodes across Admin and Manager, sorted safety first, with unread/all tabs, actor/time acknowledgments, ongoing-episode coalescing and resolved history. Acknowledgment never clears blocks. Offline alert timing remains disabled until a Pilot duration is configured.
- Admin/Manager can inspect No-show evidence, reject, mark insufficient evidence, reopen with new evidence, confirm an exemption, and review cross-cycle early-release proposals. Keep every decision; implement the 30-day first-submission rule and Q54–Q66 cycle/compensation rules. Show user notices for the required retention period and never gate driving on reading these notices.

### 4. Operations — C-024, C-029, C-042–C-047, C-056–C-062, C-070–C-072, C-129–C-130

- Show current rider/role/start time and latest GPS timestamp from trusted data. A rider phone link exists only during that rider's Active Session and is absent from historical Manager data.
- Show personal My Trips newest first without a date filter; users report a trip error, Admin corrects time/distance with reason and before/after audit. Do not add correction badges or notifications to My Trips. No route/speed/AI event history is exposed.
- Users submit categorized vehicle issues; high-risk brake/throttle issues automatically block new Sessions, lower-risk issues create alerts only. The reporter receives acknowledgment, without a repair-tracking module.
- Admin/Manager can review inspection attestations, daily reports (count, duration and distance totals/averages, distinct users). Missing distance is disclosed and excluded from averages, not treated as zero. No report export.
- Admin sets one project contact phone and versioned Return Zone/Main Geofence. Zone updates require trusted stopped evidence and no Reserved/PendingStart/Active/Paused/PendingEnd Session. Require reason and show the map/geometry before save. GPS format and zone validation use explicit coordinate limits.
- Exceptional Pending End resolution requires recorded physical inspection and trusted motor-off/stopped evidence; never merely an Admin click.

### 5. Privacy and GPS review — C-094, C-124, appendix F

- Add identity-verification metadata, decision reason, legal/retention hold, fulfillment evidence and completion time to privacy requests. Complete access requests using an account-scoped server-produced data package; route correction through the authorized field workflows (email remains immutable).
- Deletion/anonymization is a separate explicit action after identity verification, recorded decision, active-Session checks and retention/hold checks. Closing a ticket alone must never imply deletion occurred. Record per-step job status and actual results; failures remain visible for retry.
- Add project end date and a visible 30-day deadline, retention-job progress and legal-hold tracking. Provide a trusted maintenance worker for due cleanup. Never claim advisor/legal policy review has occurred; capture that review as an explicit prerequisite before enabling destructive fulfillment. Storage/Auth cleanup and revocation must be completed by the server worker, with no privileged browser key.
- Keep raw phone-GPS return checks separately with per-check 30-day expiration. Admin opens suspected-GPS reviews and records phone-call explanations (text, caller/admin/time). Manager reads summaries; only Admin edits with reason and before/after audit. Owners read their own summaries and acknowledge summary-edit notices when required. No GPS-specific explanation form or call audio.

### 6. NFC, trusted gateway and service — C-080–C-082, C-125, C-145–C-149

- Admin registers/replaces/revokes a single active NFC card per account; replacing invalidates the old card atomically. Owners can toggle their registered card without bypassing account eligibility. Never grant Admin driving access.
- Define server-only vehicle ingest/start-confirmation and offline reconciliation endpoints with authentication, replay protection, event IDs, vehicle binding, ordered processing and conflict records. Ordinary browser users cannot call trusted vehicle mutations.
- Prepare signed-manifest generation/rotation on the server, bounded by the documented maximum 24-hour lifetime, policy version and vehicle/card identity. Do not issue START/RESUME permissions when required safety/proximity/inspection evidence or a tested hardware protocol is unavailable. Show manifest version, expiry and sync/conflict state in Admin. Private signing material never enters the client.
- Safety Block clearance records physical-inspection evidence; clearing a block is distinct from final Admin service reopening. Final reopening additionally requires trusted safe vehicle state and no blocker. Pending hardware integration stays visibly unavailable and cannot become a false Available state.

## Implementation boundaries

Implement the web UI, persistence, server authorization, policy evaluation, worker/ingest contracts, migration files and meaningful automated checks on `Adminx3`. Hardware firmware, real circuit/proximity method validation, real Pilot values and advisor/legal approval are external prerequisites; represent those accurately and document each handoff. Installing a migration or deploying a worker is tracked separately from code completion; no destructive production data operation is part of this development request.

## Verification

Cover denial paths, actor/owner access, stale concurrent decisions, single-rider reservation races, category-specific cooldown behavior, nonretroactive changes, alert acknowledgment, zone edit preconditions, privacy fulfillment prerequisites, and trusted-versus-browser ingestion. Run the app build and relevant tests, distinguish pre-existing unrelated failures, and use rendered browser checks for the new Admin and affected user flows. Record migration and deployment status accurately in the final requirement matrix.
