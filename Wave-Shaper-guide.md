# Wave Shaper 2.5.1

Choose Wave A or B above the graph. Each has a three-second player; the combined result has another one. Your sound box and the pitch/effects controls fold away while you work.

## Point

Select a dot on the 1–32 grid, use the point number, or focus the graph and press left/right. Type a height from −1 to +1, then press **Set** or Enter. Exact height entry changes only that dot, regardless of the brush's neighbor setting.

**Pin point** holds its height while drawing, moving groups or shaping the wave. A small amber square marks a pin. Unpin it before setting its height. Dot 1 appears at both ends of the graph; pinning or editing either end affects that same shared dot. Save a project file to keep your pins.

With the graph focused:

- Left/right: choose the previous/next dot. Shift extends the selection.
- Up/down: nudge the selected dots using the chosen 0.001, 0.01 or 0.05 step. Shift multiplies the step by ten.
- Home/End: choose dot 1/32.
- L: pin or unpin the current dot.
- Ctrl/Cmd+A: select all 32 dots.
- Delete/Backspace: set unpinned selected dots to zero.
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z: Undo and Redo.

## Drawing and moving

**Move** starts with Only this dot. Drag vertically; the dot moves relative to where you began, so grabbing beside it does not make it jump. Ctrl-click adds a dot to the group. Shift while dragging gives finer movement. A group stops together at the height boundary instead of flattening the tallest dots.

**Neighbors** carries surrounding points with a soft brush. **Strength** blends the stroke with the original outline at 100%, 50%, 25% or 10%. **Draw snap** rounds edited heights to a chosen grid. Pins remain fixed. Peak and Trough use the height you click; Zero edge joins the neighboring slopes through zero. One stroke is one Undo. Holding an arrow key is also one Undo edit; releasing and pressing it again starts another. Undo/Redo returns keyboard focus to the graph. Ctrl-clicking the final selected point keeps it selected, so arc tools never silently switch to the entire wave.

**View** fits the cycle or zooms it ×2/×4. Scroll sideways to inspect a close-up. Selecting a dot brings it into view. Show A/B overlays the other outline for comparison; it does not change either sound.

## Arc

Drag with Select, or enter From/To and press Select arc. From 30 to 3 selects dots 30, 31, 32, 1, 2 and 3.

Scale changes the selected heights. Move shifts the group vertically while preserving its shape. Bend adds a positive or negative curve to a continuous arc of 3–31 dots, keeping both ends in place. Round, Sharpen, Straighten, Ease ends, Flip and Zero act on the selection. Pins keep their original heights.

## Wave

Peak height, trough depth and smoothness live together here. Smoothness rounds the audible curve while retaining the original editable dots. Pinned dots retain their original heights; the smoothed curve can pass between them.

Mirror half copies one side to the other. Opposite half mirrors with inverted heights. Reverse changes the direction of the cycle. Shift moves the outline by one dot. These shaping operations honor pins.

Copy to A/B and Swap A/B carry the outline, smoothness and pins. The destination's level, phase and pitch settings keep their places. Choosing a new preset replaces the outline and clears its pins, while retaining its level, phase, pitch and smoothness. Undo restores the previous state.

Keep sound stores the sound in your reusable collection. Save project keeps the complete editing session, song, original dots, pins and effects.
