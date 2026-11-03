# Page editor history

`HubPageEditor.mount(list, options)` and the portable `mountPageEditor` adapter
accept optional `history: { limit?: number, controls?: HTMLElement }`.
Omitting `history` disables undo/redo. Passing `{}` enables history with a
50-snapshot limit; an explicit limit must be an integer from 1 through 100.
Each mount owns its history. Only changes to validated layout values create
snapshots, and a new edit discards redo history. Snapshots and callback values
are detached copies of the existing layout schema.

The returned handle exposes `undo()` and `redo()`, returning whether a change
occurred, and `canUndo()` / `canRedo()`. Successful undo/redo renders the layout,
calls `onChange` once, and announces the action. Successful external `update`
clears both stacks without calling `onChange`; invalid updates throw before
changing the layout or history.

Optional `controls` receives an owned group named “Edit history” containing
Undo and Redo buttons with current disabled states. The controls host must be
outside the list: the list itself and descendants are rejected. Existing host
children remain intact. Controls persist during renders, preserving their focus;
focus within the list follows its section when history changes. No global
keyboard shortcuts are installed.

`destroy()` is idempotent, clears the list and history, and removes only its own
controls group from the controls host. Afterwards all four history methods return
false and `update` does nothing, including for invalid input. Retained detached
editor buttons cannot revive a destroyed mount.

This is local presentation history, with no autosave, release activation, or
permission changes. Tests use the actual editor and layout scripts in isolated
VM contexts with minimal DOM host ports; they do not certify browser behavior.
