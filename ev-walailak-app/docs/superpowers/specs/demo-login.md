# EV Walailak Demo Login — Design Spec

## Purpose and approved scope

Add a demo-only sign-in screen and session flow to the existing EV Walailak React + TypeScript prototype. The user selected mock/demo accounts and agreed that the page must clearly disclose that this is not real authentication. The screen gates the prototype pages by demo role; it does not provide production security.

## Visual direction

- Desktop concept: `C:\Users\msl\.codex\generated_images\01a15806-fe8a-7970-a58c-1af88daebd3f\exec-80fb25df-4375-4e7e-9a24-a59cc9bd5ed8.png`
- Mobile concept: `C:\Users\msl\.codex\generated_images\01a15806-fe8a-7970-a58c-1af88daebd3f\exec-d6c1984a-b8f3-4ccd-9e00-07e4b1c73a9e.png`
- EV-01 transparent-background visual derived from the existing bike image: `C:\Users\msl\.codex\generated_images\01a15806-fe8a-7970-a58c-1af88daebd3f\exec-1cde8c30-a066-44f8-9ac7-33e99b32e3d5.png`
- Reuse the app's visual tokens: navy `#17365d`, blue `#2563eb`, page background `#f2f7fd`, white surface, border `#dbe5f0`, text `#1b2b40`, muted `#687a91`; retain the existing Thai-friendly system font stack.
- Desktop: quiet split screen, dark navy identity area on the left with EV Walailak branding and the existing EV-01 motorcycle visual; pale blue content area on the right with a single white login surface.
- Use the transparent-background EV-01 visual only if its alpha cutout is verified; otherwise keep the existing bike asset framed on a matching dark surface rather than showing a mismatched black rectangle.
- Mobile: compact navy identity band, hide the large motorcycle visual, and show the form and demo shortcuts in one scroll-safe column.
- Keep labels and controls as real HTML; generated images are references only, never production UI.

## Visible content and interactions

- Brand: `EV Walailak` and `ระบบรถจักรยานยนต์ไฟฟ้า`.
- Heading: `เข้าสู่ระบบ`; supporting line: `ลงชื่อเข้าใช้เพื่อใช้งานระบบรถจักรยานยนต์ไฟฟ้า`.
- Fields: `อีเมล`, `รหัสผ่าน`; provide a keyboard-accessible show/hide password control.
- Primary action: `เข้าสู่ระบบ`.
- Demo account area: `บัญชีทดลอง` with shortcuts `นักศึกษา`, `พนักงาน`, `ผู้จัดการ`, and `ผู้ดูแลระบบ`. Selecting a shortcut fills its email and the shared demo password; it does not sign in until the primary action is submitted.
- Disclose: `ข้อมูลบัญชีนี้เป็นข้อมูลจำลอง ไม่ใช่ระบบยืนยันตัวตนจริง`.
- Invalid credentials show the generic message `อีเมลหรือรหัสผ่านไม่ถูกต้อง` without revealing which field was wrong.
- Do not add registration, real password reset, or external identity-provider flows.

## Demo accounts and role access

All demo accounts use the shared password `Demo1234!`.

| Display | Email | Role | Allowed pages | Landing page |
|---|---|---|---|---|
| นภัส · นักศึกษา | `student@demo.wu.ac.th` | Student | home, ride | home |
| พนักงานทดลอง | `employee@demo.wu.ac.th` | Employee | home, ride | home |
| ผู้จัดการระบบ | `manager@demo.wu.ac.th` | Manager | home, ride, manager | manager |
| ผู้ดูแลระบบ | `admin@demo.wu.ac.th` | Admin | admin | admin |

Unauthenticated users see only the login page. Navigation contains only pages allowed for the signed-in role. Attempting a disallowed page returns to that role's landing page. Logout clears the demo session and returns to login.

## Session behavior and security limits

- Store only the demo user's `id`, `name`, `email`, and `role` in a versioned `sessionStorage` entry; never store the password.
- Restore the current tab's demo session after refresh. Corrupt, stale, or unknown-role data is rejected and cleared where possible.
- If browser storage is unavailable, login/logout still work for the current in-memory app session; persistence is best-effort.
- This client-only mock is not secure, does not verify identity, and must not be presented as production authentication. Supabase/backend auth, account provisioning, and secure authorization are out of scope.

## Acceptance checks

1. Initial load without a valid demo session shows the login screen and no app navigation.
2. Each listed account can enter with the shared password, lands on the correct page, and sees only permitted navigation.
3. Incorrect credentials show the generic error; selecting a demo shortcut fills the form without bypassing submit.
4. Reload restores a valid session; logout removes it; malformed data or blocked storage does not crash the app.
5. Password visibility toggles and form controls remain usable with keyboard and at desktop/mobile widths.
