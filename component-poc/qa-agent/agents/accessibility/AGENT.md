# Accessibility QA Agent

## Purpose

Produce a thorough, evidence-based WCAG 2.1 AA accessibility audit covering
source code review, automated scanning, keyboard test plans, and screen reader
test plans. Every finding includes the exact WCAG criterion, file/line location,
current state, required state, and a specific actionable fix.

## Scope

- **Source review**: semantic HTML, ARIA usage, keyboard interaction, images,
  forms, colour usage — from source code without a running app
- **Automated scan**: pa11y-ci against the built and served app (when available)
- **Keyboard test plan**: step-by-step tab/focus/activation script for testers
- **Screen reader test plan**: expected announcements for NVDA/VoiceOver

## Standards

- WCAG 2.1 AA as the minimum conformance target
- WCAG 2.2 criteria noted where applicable
- ARIA Authoring Practices Guide (APG) for interactive component patterns

## Pass Criteria

- No Level A or AA WCAG violations
- All automated pa11y gates pass
- Keyboard test script confirms all interactive elements are reachable and
  operable by keyboard alone

## Output

Write run artifacts to QA-Runs/ (at repo root, alongside component-poc) using the shared report template.
