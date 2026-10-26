# Admin page compared with the reconciled project requirements

Source: `EV_Motorcycle_Handoff_2026-10-14_C144_RECONCILED.md` and `EV_Motorcycle_Requirements_FULL_2026-10-14_C144_RECONCILED.txt` supplied by the project owner. The downloaded text files have the same substantive content as the copies in this repository; the DOCX copy is identical. Later confirmed amendments in the Handoff take precedence over older role wording.

This audit describes the `Adminx2` branch. The new migration has **not** been applied to the hosted Supabase project. Without it, the page shows all sections and an unavailable banner, with write controls disabled. The existing pending-account RPC can still show its account list independently.

| Requirement | Branch status | Remaining work |
| --- | --- | --- |
| C-083–C-084 account review | Existing pending-account review supports one account at a time, external affiliation confirmation, and approve/reject. | Confirm the existing account-review migration is installed. |
| C-132–C-136 Driving Permission | Separate Admin control and explicit induction confirmation are stored and audited. | Connect the server's real Web Session Start authorization to this flag. NFC offline authorization must follow C-145–C-149. |
| C-110, D-003 start days and times | Admin can set days and times for Student and Employee. No default hours are invented; Manager is exempt in policy. | Enforce the saved window in the server's Session Start decision. Active Sessions must continue beyond the window. |
| C-123/Q67–Q69 cancellation/no-show | Admin can save nullable Pilot thresholds and cooldowns with an effective timestamp. The page explicitly reports that event based warnings are unavailable. | Pilot must establish numerical values and warning bands. Session events, evaluation windows, counters, restrictions, and near-threshold warnings need backend implementation. Existing restrictions must not be recalculated retroactively. |
| C-094 personal-data requests | Users can submit access/correction/deletion requests; Admin can review them with notes and audit. | Identity verification, legal decision procedure, actual data fulfillment, and end-of-project deletion/anonymization within 30 days remain to be designed and implemented. Closing a request does not perform deletion. |
| C-100–C-104 announcements | Admin can target any subset of four roles, choose immediate/scheduled publication, optional expiry, and important notices. Important notices show once per user after sign-in and wait while a Session is Active. Author and effective publish time are stored. | Deploy migration and verify the workflow with real Supabase users. |
| Audit of Admin actions | Account review and new portal actions are shown in the latest-100 log. | Other future Admin workflows must also write immutable before/after records. |
| C-058, C-125 service state | Web Admin records manual stop, safety block, clearing, and final reopening confirmation with a reason. | Connect to authoritative vehicle state and safety evidence; the web record alone cannot open the vehicle. |
| Dashboard | Pending accounts, permission reviews, and open privacy requests are counted when the portal RPC is available. | Operational alerts and near-threshold warnings need real event streams and Pilot thresholds. |

## Admin requirements outside the original eight sections

| Requirement | Missing Admin capability |
| --- | --- |
| C-017, C-085–C-087 | Edit a user's legal name with audit, review/suspend ineligible accounts, change role with before/after audit, search and filter all four account states, and handle review requests. The live page currently lists Pending only. |
| C-024, C-029 and Geofence decisions | Edit the vehicle Return Zone and Main Geofence with a version/reason and enforce the stopped vehicle/no Active or Pending End preconditions. |
| C-042–C-043 | Show the real current rider, role, Session start time, latest GPS timestamp, and call the active rider. The Manager/vehicle panels currently use sample data. |
| C-045, C-047 | Receive My Trips correction reports and let Admin correct time/distance with reason and before/after audit. |
| C-050–C-055 | Shared operational alert episodes, unread counts, priority order, tabs, and Admin/Manager acknowledgment with actor/time. Existing visual alerts are sample data. |
| C-061 | Set and expose the central project phone number. |
| C-070 | Daily usage report with dates, Session count/duration/distance and unique users. |
| C-080–C-082, C-145–C-149 | Register/replace a user's single NFC card, revoke the old card, and integrate signed offline manifests and event reconciliation. This requires backend and ESP32 work in addition to Admin UI. |
| C-129–C-130 | Review recorded pre-ride inspection attestations by user and time. |

The block diagram also identifies vehicle GPS/BMS/AI/network status and Supabase policy decisions as sources for the operational dashboard. The current web prototype has no authoritative vehicle or Session event feed; it must not display guessed operational status as live data.
