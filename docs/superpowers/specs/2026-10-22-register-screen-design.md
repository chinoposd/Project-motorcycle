# Register Screen Design

## Goal

Add a Thai-first registration prototype to the EV Walailak web app on the `register` branch. The form should match the existing navy and blue visual theme while taking layout cues from the supplied reference. It must clearly remain a prototype until a database and authentication service are connected.

## Scope and constraints

- This change adds a front-end registration flow only; it does not create accounts, call Supabase, or persist submitted data.
- Registration choices are Student and Employee. Manager and Admin are not self-service registration choices: the requirements say applicants cannot elevate their own role and Admin accounts are provisioned by an administrator.
- Do not add date of birth or student/personnel ID fields. The requirements do not require them.
- Use the existing React, TypeScript, CSS, and lucide-react dependencies. Do not add dependencies.

## Form and behavior

The registration screen is opened from a visible “สมัครสมาชิก” action in the app header. It uses a large rounded, two-column dialog-style surface over the current page on desktop: a scrollable form on the left and a project-specific information panel on the right. On narrow screens, the content becomes a single-column layout with the information panel below the form. Closing or cancelling returns to the page that opened it.

Required fields are first name, last name, telephone, email, applicant type, password, and password confirmation. Email verification is described as a future step; the prototype must not imply an email was sent.

Password requirements, shown as live checklist items, are:

- At least 9 characters (interpreting “more than 8” literally).
- At least one lowercase English letter.
- At least one uppercase English letter.
- At least one digit.
- At least one non-alphanumeric symbol; whitespace alone does not satisfy this requirement.

Allow toggling password visibility. Prevent submission while required fields are missing, a password rule fails, or the confirmation does not match. On valid submission, show a clear prototype confirmation that the information passed local validation but no account was created or saved. Do not retain values after closing the dialog.

## Visual design

Reuse the app’s existing CSS variables, font, buttons, border colors, and shadow language. Apply a restrained blue/teal accent to registration-specific details to reflect the supplied example while preserving the EV Walailak identity. The information panel should describe the electric motorcycle project and pending administrator approval, not the unrelated service shown in the reference image.

## Accessibility and responsive behavior

- Every input has a visible label and programmatic association; required fields and validation errors are announced accessibly.
- Password criteria expose pass/fail state in text, not color alone.
- The dialog has an accessible name, close control, and keyboard-operable actions.
- At mobile widths, avoid horizontal overflow and keep submit/cancel controls reachable without nested horizontal scrolling.

## Acceptance criteria

1. A user can open, complete, validate, submit, cancel, and close the registration prototype.
2. The selectable account types are limited to Student and Employee.
3. Password validation implements all five stated requirements, and confirmation must match.
4. A valid submission clearly says that no account was created and no data was saved.
5. The form follows the EV Walailak theme and adapts to narrow screens.
6. No database, authentication, or new dependency is introduced.

## Source requirements

- `EV_Motorcycle_Requirements_FULL_2026-10-14_C144_RECONCILED.txt`, sections 5.0–5.1: registration details, approval status, and role provisioning.
- `EV_Motorcycle_Handoff_2026-10-14_C144_RECONCILED.md`, C-016 and C-017: Thai-first site and account profile rules.
- User-provided registration reference image and password policy supplied in chat on 2026-10-22.
