# Ink history-preserving resize

[English](./ink-resize.md) | [日本語](./ink-resize.ja.md) | [简体中文](./ink-resize.zh-CN.md)

## Dependency patch application

[`ink+7.1.1.patch`](../../patches/ink+7.1.1.patch) is applied by `npm run patch:dependencies` automatically after
development dependency installation, before builds/watch, and before
`npm test` / `npm run test:it`. The install hook runs only when both the patch
asset and the local `patch-package` CLI exist. Published bundles already include
patched Ink and omit these development assets, so their install hook does not
require dev dependencies. Patch failures in development installs still fail the
installation. Nix reapplies the patch directly after recreating its production
dependency tree. Ink is pinned and bundled in the published npm package, so the
build's patched renderer is shipped with TAKT.

To apply or reapply the patch from the repository root with development dependencies installed:

```sh
npm run patch:dependencies
```

## Live resize pause

On main-screen interactive TTY resize events, pause live drawing until there
have been no further resize events for 150ms. Cancel queued old-width frames.
Once resizing settles, erase only the owned live region and redraw the current
input/status region at the new size. Do not clear the screen or scrollback, and
do not replay committed `<Static>` entries: the terminal owns existing history.
This also handles bursts that finish at the original width. The main-screen
fullscreen fallback also erases only live rows and prints only new static
output, rather than clearing history and replaying the entire transcript.

## Transcript reflow and limitations

`TranscriptView` uses the patched `<Static renderOutput>` opt-in for terminal
output. Each new item is serialized directly from sanitized source text, without
Ink's width-dependent hard breaks or space padding. The terminal can therefore
reflow both user and AI paragraphs when narrowed or widened, even in scrollback.
Explicit source newlines remain hard breaks. Native wrapped continuation rows
start at the left edge; explicit continuation lines retain the marker indent.
User bands are painted with erase-to-end **before** their text, rather than
literal padding spaces. Erasing after text at an exact right margin can erase
its last glyph when the terminal clamps its pending-wrap cursor. Their old
background padding is not repainted on resize. Output already printed
by the old renderer retains its hard breaks; it cannot be repaired without
replacing terminal history. Non-TTY and screen-reader output uses the normal
React children rather than the terminal serializer.

## Live-region cursor anchoring

Only the task conversation mount passes `{ anchorLiveFrame: true }` to
`mountInk()`; manager, auxiliary prompts and dispatch mounts keep Ink's default
render options. In the anchored conversation frame, the hidden physical cursor stays
at the **top** of the live frame (the first row, or the row below a one-row
border), and the frame forms one soft-wrapped group. Xterm-like
terminals leave the cursor's group for the application to redraw. Height
reductions discard live rows below the cursor instead of pushing their leading
input/Thinking rows into scrollback. Clear moves up from this cursor by the
rows drawn above it (not DECRC, which terminals do not adjust when they reflow
or trim rows) and erases downward, never committed rows above it. Allocate blank rows before painting, and paint
bottom-to-top with wraparound disabled: even a resize between PTY chunks cannot
push already-painted live rows above the cursor into history. Unicode width
differences and tabs cannot add uncontrolled live rows. Teardown clears the
owned region. This opt-in overrides incremental rendering.

The task conversation starts the editor window on its **caret row**, directly
below the input's top border. `useCursor()` positions the physical cursor at the
Japanese IME insertion column on that row. Status, notices, queued lines,
completions, hints and the model label are all below the caret. At small heights
notices and queued input take priority over the two border rows. Earlier draft rows are folded, with `↑ N` below the input indicating
how many display rows precede the caret. Up/down editing still reaches those rows,
and submission and handoff retain the entire original buffer. Other prompt and
manager layouts are not changed by this conversation-only opt-in.

This arrangement is necessary: saving the first-row position and moving the real
cursor lower does not protect rows above it. A terminal may archive them during
height shrink, before the application's resize handler can erase them. xterm.js
removes rows below the cursor first, so a single border row above the caret
survives down to two rows. Frames with a hardware cursor on the first or second
row therefore use the wrapped-group renderer even when a direct Ink caller has
not set `anchorLiveFrame`. This automatic selection only applies to main-screen
interactive TTY rendering and occurs before a live frame is drawn; lower hardware
cursors retain the standard/incremental path. Clearing for
resize or static output retains the cursor intent, so IME positioning does not
silently disappear until the next input edit. Oversized output is clipped from
its bottom; rows above the cursor (the border) are dropped only when the caret
row would not fit otherwise.

### Input width and confirmation rows

The editor draws each preserved tab as one space. Wrapping, up/down movement and
the physical cursor all measure that same display width; submission and handoff
retain the original tabs. A pending provider confirmation reserves one row below
the input before status and optional chrome. It is sanitized to one line and
truncated to the terminal width. At heights 1–2 only the input row fits, so the
confirmation becomes visible after enlargement. Ctrl+C/Ctrl+D rejects the pending
confirmation before draining its submission.

### IME commit and Enter input contract

Ink's `useInput()` exposes text and key flags, not IME composition state. When a
terminal delivers committed Japanese text (including a CR within the same text
event), it edits the draft without sending; a separate Return event sends it.
Regression tests cover these distinct input events in chat and summarize modes.
If a terminal instead reports conversion confirmation as a separate bare CR,
that event is indistinguishable from the user's send Enter. No timing or
Japanese-character heuristic can reliably separate them. Supporting that case
requires terminal/IME-specific composition signalling and a real input trace;
the existing tests do not claim universal composition-Enter detection.

### macOS Terminal.app

Terminal.app differs from xterm.js terminals (Orca, VS Code) in three measured ways:
it rewraps the group that holds the cursor, its cursor follows the rewrapped
content, and a height reduction keeps the rows below the cursor while archiving
rows above it. DECSC is not adjusted by its reflow, so the renderer finds the
frame's first row from the cursor's position in the rewrapped group instead of
restoring a saved position.

Narrowing therefore makes the full-width group taller (five 120-cell rows become
ten rows at 60 columns). A redraw that only erased from the anchor would leave the
extra rows blank below the new frame. On the next height reduction Terminal.app
keeps those blank rows and archives the input's top rows instead. When
`TERM_PROGRAM` is `Apple_Terminal`, an explicitly anchored conversation mount
also sets `reflowsCursorGroup`; other mounts do not receive this option. The
anchored renderer then recomputes the drawn group's height at the new width,
including the cursor's row when the caret reflows past the new width. It ends the
redraw where the rewrapped group ended, and the leftover rows become blank leading
rows of the same wrapped group. They do not accumulate: widening rewraps them
away, and the next static output starts on them. The scaffold fills only one cell
of the frame's last row, so a later rewrap counts the cells actually drawn rather
than a full padded row. If the rewrapped group is taller than the window, every
visible row belongs to the old frame: the redraw erases the screen (not
scrollback) and draws the frame at its bottom.

One limitation remains. When the new window is not taller than the input area
(including its rewrap), Terminal.app keeps the rows below the cursor and archives
the rows above it before TAKT is notified. Examples are 120×30 → 60×8, or a height
of about 6 rows for a one-line input (7 with a folded multi-line draft): the top
border, and below about 5 rows the caret row, are left in scrollback. Clearing
scrollback would remove the user's history, so TAKT leaves those rows there.

For other frames without that opt-in, the `log-update.js` patch counts the previous frame's rows
at the current terminal width, including ANSI-styled padding and wide
characters. Standard and incremental renderers restore a hardware cursor's
position relative to that reflowed frame before erasing.

## Lifecycle and rendering fallbacks

Static output committed during the drawing pause is queued, not discarded.
Explicit output/flush, clear, suspension and unmount settle the pending resize
before taking over the terminal. Unmount cancels the timer so no delayed frame
can overwrite a selector or leak after exit. Waiting for an already unmounted
instance also avoids registering a new process-exit listener. Alternate-screen,
debug, non-TTY
and screen-reader rendering keep their existing resize paths.

## Regression coverage

Regression coverage in [`src/__tests__/tui-conversation-view.test.tsx`](../../src/__tests__/tui-conversation-view.test.tsx) checks the
entire emulated terminal buffer, including preexisting shell scrollback. It
covers narrowing/widening, rapid bursts, busy `/go` drafts, hardware cursors,
height reductions with multiline drafts (including emoji/tabs), first-row Japanese
cursor positions with queued status at heights 1/2/3/5/6, Terminal.app redraws
that end at the rewrapped group (including one taller than the window) without
accumulating blank rows across resize cycles, resizing between
partial PTY-frame chunks, exact-right-margin user text, static commits during
resizing, fullscreen transitions, unmount, queued handoffs
and task dispatch.
[`e2e/specs/tui.e2e.ts`](../../e2e/specs/tui.e2e.ts) also resizes a real PTY and checks offscreen history,
selector remounts and the live input/Thinking region without replaying history.
Tests commit English/Japanese user and AI paragraphs at a narrow width and verify
that they become single rows again when widened. The PTY regression also keeps
older offscreen messages while resizing these paragraphs repeatedly. A real-PTY
height regression checks idle and busy multiline drafts at 8/6 rows and on
re-expansion, with 70 committed history lines preserved exactly once. Another real-PTY
regression checks the Japanese draft's physical insertion cursor at heights 1/2/3/6
and confirms that folding does not alter the submitted multi-line text. These cursor
checks do not observe a macOS IME composition or candidate window; that still needs
GUI verification.
