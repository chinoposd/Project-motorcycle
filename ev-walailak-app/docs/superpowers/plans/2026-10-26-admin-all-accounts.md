# Admin all-accounts view

Scope: complete the Admin User Management list required by C-083–C-087 and C-017. Keep account approval separate from Driving Permission.

1. Add a read-only, Admin-gated RPC returning every profile with email, role, status, status reason, and timestamps. Keep the existing pending-review RPC for individual approvals.
2. Add an audited Admin-gated RPC for account name, role, suspension, restoration, and individually confirmed Driving Permission (including Manager). Require a reason, lock the target row, prohibit self role/status changes, and disable Driving Permission when an account changes role or becomes Suspended.
3. Replace the live pending-only list on AdminPage with all accounts, status tabs, search, and a detail dialog. Pending accounts retain the existing approve/reject flow; reviewed accounts expose only valid actions. Demo mode stays read-only.
4. Show rejection/suspension reasons to affected users in the approval status screen. Backfill existing rejection reasons from the review audit and capture reasons on future reviews.
5. Verify the UI render, TypeScript build, SQL migration on the project linked in `.env.local`, Admin RPC read, role isolation and migration history. Do not mutate real account data during verification.
