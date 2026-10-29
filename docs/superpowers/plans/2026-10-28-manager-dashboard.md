# Manager Dashboard Implementation Plan

**Goal:** Make the existing Manager dashboard useful for web operations before vehicle hardware is connected.

**Architecture:** Keep the existing React routes and Operations RPC. Add a Manager-focused overview with clear data provenance, session work queue, behavior warnings, No-show reviews, and read-only operational audit. The demo route uses its existing browser-local prototype data and labels it as such.

**Tech Stack:** React, TypeScript, Vite, Supabase PostgreSQL, existing CSS and lucide icons.

## Work

- [x] Extend the Operations snapshot with a bounded, read-only Manager audit summary that excludes before/after payloads and personal-data administration actions.
- [x] Add Manager dashboard components for status, session workflow, behavior warnings, and activity; preserve existing review actions.
- [x] Bring the demo Manager overview into the same hierarchy using prototype state and explicit demo labels.
- [x] Improve desktop and mobile layout in the existing visual language.
- [x] Build and inspect the resulting diff. Hardware-dependent actions remain pending states.
