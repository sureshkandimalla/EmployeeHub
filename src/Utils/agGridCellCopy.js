// Right-click-to-copy for grid cells that aren't already a link/action (an
// editable cell, a Timesheet/Project link, a button renderer, etc.) — most
// useful on plain-text columns like Employee Email, where there's no other
// way to grab just that one value without manually selecting/retyping it.
// Drop into any AgGridReact as `getContextMenuItems={getCellCopyContextMenuItems}`
// — and also pass `popupParent={gridPopupParent}` on the same grid (see
// below for why that second prop isn't optional).
//
// AG Grid Enterprise's own built-in context menu already offers "Copy" /
// "Copy with Headers", but this app has no license key configured
// (grep turns up no setLicenseKey call), so relying on the licensed
// default behavior isn't dependable — this builds the same "Copy" entry
// explicitly instead, using the browser's own Clipboard API. Menu is
// Copy-only, not Copy+Export — every grid already has its own Export
// Excel button in the toolbar, so a second Export entry here was
// redundant clutter, not a second feature.
export const getCellCopyContextMenuItems = (params) => {
  const value = params.value;
  if (value === undefined || value === null || value === "") return [];

  const text = String(value);
  return [
    {
      name: `Copy "${text.length > 40 ? text.slice(0, 40) + "…" : text}"`,
      action: () => {
        navigator.clipboard?.writeText(text).catch(() => {
          // Clipboard API needs a secure context (https/localhost) and
          // user-gesture — if it's unavailable for some reason, there's
          // nothing more to do here; the menu item simply no-ops.
        });
      },
    },
  ];
};

// AG Grid mounts popups (this context menu included) as a child of the
// grid's own root element by default. Every grid wrapper in this app sizes
// itself via a flex/height-100% ancestor chain (the .project-List-grid /
// .employee-List-grid CSS classes), and the popup appearing inside that
// chain mid-render was observed to collapse the grid's measured height to
// 0 for a frame (confirmed via devtools: .ag-body-viewport briefly reports
// height:0 the instant the menu opens, even though its row content
// underneath is still fully sized) — visually, the whole grid blanks out
// behind the menu. Passing this as every grid's `popupParent` renders the
// popup under <body> instead, outside the grid's own layout measurement
// entirely, which avoids the collapse.
export const gridPopupParent = document.body;
