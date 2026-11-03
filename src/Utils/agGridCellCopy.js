// Right-click-to-copy for grid cells that aren't already a link/action (an
// editable cell, a Timesheet/Project link, a button renderer, etc.) — most
// useful on plain-text columns like Employee Email, where there's no other
// way to grab just that one value without manually selecting/retyping it.
// Drop into any AgGridReact as `getContextMenuItems={getCellCopyContextMenuItems}`.
//
// AG Grid Enterprise's own built-in context menu already offers "Copy" /
// "Copy with Headers", but this app has no license key configured
// (grep turns up no setLicenseKey call), so relying on the licensed
// default behavior isn't dependable — this builds the same "Copy" entry
// explicitly instead, using the browser's own Clipboard API, and works
// whether or not the Enterprise default menu is also showing.
export const getCellCopyContextMenuItems = (params) => {
  const value = params.value;
  const items = [];

  if (value !== undefined && value !== null && value !== "") {
    const text = String(value);
    items.push({
      name: `Copy "${text.length > 40 ? text.slice(0, 40) + "…" : text}"`,
      action: () => {
        navigator.clipboard?.writeText(text).catch(() => {
          // Clipboard API needs a secure context (https/localhost) and
          // user-gesture — if it's unavailable for some reason, there's
          // nothing more to do here; the menu item simply no-ops.
        });
      },
    });
    items.push("separator");
  }

  // Not "copy"/"copyWithHeaders" — those are AG Grid Enterprise's own
  // built-ins and need the separate ClipboardModule (not registered in
  // this app), so they'd render as no-ops and log a console error. Export
  // is a different, already-working built-in (the module it needs ships
  // with the ag-grid-enterprise bundle this app already imports).
  return [...items, "export"];
};
