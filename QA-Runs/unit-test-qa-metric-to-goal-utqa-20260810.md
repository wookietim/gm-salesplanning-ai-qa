# Unit-Test-QA Run Report — metric-to-goal.ts
**Agent:** unit-test-qa  
**Run ID:** utqa-20260810  
**Date:** 2026-08-10  
**Project:** gm-salesplanning-frontend  
**Target:** `src/utils/metric-to-goal.ts`  
**Overall status:** ❌ FAIL (2 bugs found)  
**Cleanup:** ✅ `__unit-test-qa-tmp__` deleted

---

## 1. Summary

| Metric | Value |
|---|---|
| Units targeted | 1 (`metricToGoal`) |
| Tests generated | 19 |
| Tests passed | 17 |
| Tests failed | **2** |
| Tests errored | 0 |
| Temp dir deleted | ✅ YES |

---

## 2. Generated test code

```typescript
import { describe, expect, it } from 'vitest';
import { metricToGoal } from '../src/utils/metric-to-goal';

describe('metricToGoal', () => {

    describe('happy path', () => {
        it('returns "above" when actual exceeds goal', () => {
            // index = 110/100*100 = 110, difference = -Math.round(-10) = 10 ≠ 0 → above
            const result = metricToGoal(110, 100);
            expect(result.performance).toBe('above');
            expect(result.index).toBe(110);                 // ← FAILS: 110.00000000000001
            expect(result.difference).toBe(10);
        });

        it('returns "onTarget" when actual equals goal exactly', () => {
            // index = 100, difference = -Math.round(0) = 0 → onTarget
            const result = metricToGoal(100, 100);
            expect(result.performance).toBe('onTarget');
            expect(result.index).toBe(100);
            expect(result.difference).toBe(0);             // ← FAILS: -0 not +0
        });
        // ... [17 more tests — all pass]
    });
    // [threshold boundaries, error handling, edge cases — all 17 passing]
});
```

*(Full test file was auto-deleted with temp dir. This excerpt captures the two failing assertions.)*

---

## 3. Per-test results

| Test | Status | Evidence |
|---|---|---|
| happy path > returns "above" | ❌ FAIL | `expected 110.00000000000001 to be 110` |
| happy path > returns "onTarget" (difference) | ❌ FAIL | `expected -0 to be +0` |
| happy path > returns "below" at 95% | ✅ PASS | |
| happy path > returns "critical" below 90% | ✅ PASS | |
| index calculation: (actual/goal)*100 | ✅ PASS | |
| difference negative when below goal | ✅ PASS | |
| difference positive when above goal | ✅ PASS | |
| difference rounds fractional index | ✅ PASS | |
| boundary: index 90 → "below" not "critical" | ✅ PASS | |
| boundary: index 89.9 → "critical" | ✅ PASS | |
| boundary: index 100.4 → "onTarget" (rounds to 0) | ✅ PASS | |
| boundary: index 100.6 → "above" | ✅ PASS | |
| boundary: index 99.5 → "below" not "onTarget" | ✅ PASS | |
| error: throws when both 0 | ✅ PASS | |
| error: throws when goal is 0 | ✅ PASS | |
| error: no throw when actual is 0, goal non-zero | ✅ PASS | |
| edge: non-100 goal values | ✅ PASS | |
| edge: decimal goal values | ✅ PASS | |
| edge: large values no NaN | ✅ PASS | |

---

## 4. Findings

---

### FINDING-1 — Floating-point imprecision in `index` return value

| | |
|---|---|
| Severity | **Medium** |
| Test | `happy path > returns "above" when actual exceeds goal` |
| Source file | `src/utils/metric-to-goal.ts:18` |
| Actual value | `110.00000000000001` |
| Expected value | `110` |

**What happened:**  
`(110 / 100) * 100` in JavaScript produces `110.00000000000001` due to IEEE 754
floating-point arithmetic. The function returns the raw computed `index` without
rounding, so callers receive imprecise values.

**Production impact:**  
Any code that displays `result.index` directly (e.g. as a percentage label in a
dashboard card) will show `110.00000000000001` instead of `110`. Any code that
compares `result.index === 110` will silently fail.

**Fix:**  
Round `index` before returning it in `metric-to-goal.ts:18`:
```ts
// Before
const index = (metricActual / goal) * 100;

// After
const index = Math.round((metricActual / goal) * 100 * 10) / 10; // 1 decimal place
// or for integer precision:
const index = Math.round((metricActual / goal) * 100);
```

---

### FINDING-2 — `difference` returns `-0` instead of `0` when on target

| | |
|---|---|
| Severity | **Low** |
| Test | `happy path > returns "onTarget" when actual equals goal exactly` |
| Source file | `src/utils/metric-to-goal.ts:19` |
| Actual value | `-0` |
| Expected value | `0` |

**What happened:**  
When `metricActual === goal`, `index = 100`, `100 - index = 0`,
`Math.round(0) = 0`, `difference = -1 * 0 = -0`.

JavaScript's `-0` is distinct from `+0` under strict equality (`Object.is(-0, 0) === false`),
which is what Vitest uses. So `expect(-0).toBe(0)` fails.

**Production impact:**  
Low — most rendering contexts treat `-0` and `0` identically. However, any code that
does `if (result.difference === 0)` would still work (`-0 === 0` is `true` in
loose equality). The risk is if the difference is ever serialised to JSON and back
(`JSON.parse(JSON.stringify(-0))` returns `0`), or compared with `Object.is()`.

**Fix:**  
```ts
// Before
const difference = -1 * Math.round(100 - index);

// After  
const difference = Math.round(index - 100); // avoids -0; same result, opposite sign convention
// or explicitly:
const difference = Object.is(raw, -0) ? 0 : raw;
```

---

## 5. Coverage assessment

| Code path | Covered |
|---|---|
| `metricActual === 0 && goal === 0` → throw | ✅ |
| `goal === 0` → throw | ✅ |
| `difference === 0` → 'onTarget' | ✅ |
| `index > 100` → 'above' | ✅ |
| `index >= 90` → 'below' | ✅ |
| `else` → 'critical' | ✅ |
| Boundary: index exactly 90 | ✅ |
| Boundary: index exactly 100.4 (rounds to 0) | ✅ |
| Floating-point arithmetic | ✅ (reveals bug) |
| `-0` arithmetic | ✅ (reveals bug) |
| Non-integer goal values | ✅ |
| Large values | ✅ |
| `metricActual === 0, goal > 0` | ✅ |

**Not covered (requires browser/live data):**  
- None. `metricToGoal` is a pure function with no external dependencies.

---

## 6. Cleanup confirmation

```
Temp directory __unit-test-qa-tmp__ deleted: YES
Path: /Users/timothy.collins/Documents/ikea work/gm-salesplanning-frontend/__unit-test-qa-tmp__
Verified: directory does not exist post-cleanup
```
