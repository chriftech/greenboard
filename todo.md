# To do

## Multiple boards

Let users create new boards, each with its own tasks, while **My board** stays as their personal board.

### What it should do

- **My board stays the personal board.** It's always there, can't be renamed or deleted, and keeps every task that exists today, so nobody loses anything when this ships.
- **Create boards:** a **+ New board** option in the sidebar, asking for a name (and maybe an icon or colour). The new board opens empty.
- **Separate tasks:** each board has its own tasks. Adding, ticking, filtering, search, Today/Upcoming, Trash and the bulk-selection bar only ever act on the open board.
- **Switch boards** from a **Boards** section in the sidebar, under Workspace, with My board first. The open board is highlighted, and its name shows in the board header.
- **Rename and delete** boards, except My board. Deleting asks for confirmation and says how many tasks go with it. It could move them to Trash rather than deleting them outright.
- **Remember** the last board opened, and give each board its own URL (e.g. `/board/<id>`, with `/board` meaning My board), so a board can be bookmarked or refreshed.

### Decisions to make first

- **Per board or shared?** Columns and workflow, tags, collapsed columns and settings could each belong to one board or be shared. A reasonable default: columns, workflow and collapsed columns per board; custom tags and settings shared.
- **Moving tasks:** whether a task can move from one board to another (a "Move to board" action in the details panel and the bulk bar).
- **Limit:** whether there's a maximum number of boards.
- **Trash:** one Trash per board, or a shared Trash that shows which board each task came from.
- **Export and import:** whether they work on the open board only, with the board's name in the file name.

### How it fits the current code

All data is saved in this browser's `localStorage` (Firebase is only used for sign-in):

| Data | File | Key |
| --- | --- | --- |
| Tasks | `lib/tasks.ts` | `greenboard.tasks.v1` |
| Columns and workflow | `lib/columns.ts` | `greenboard.columns.v1` |
| Collapsed columns | `lib/collapsed-columns.ts` | `greenboard.collapsed-columns.v1` |
| Custom tags | `lib/tags.ts` | `greenboard.tags.v1` |
| Settings | `lib/settings.ts` | `greenboard.settings.v1` |

A possible approach:

1. **Boards store:** a new `lib/boards.ts` holding the list of boards (`{ id, name, createdAt }`) and the active board id, with My board fixed as `id: "personal"`.
2. **Per-board keys:** stores that become per board read and write `greenboard.<name>.<boardId>.v1`, and reload their cache when the active board changes.
3. **Migration:** on first load, existing data stays in place as My board's data (or is copied to `…personal…` keys), so current users see no change.
4. **UI:** a Boards section in `components/board/sidebar.tsx`, a board name in the header, a create/rename dialog (like `tag-editor.tsx`), and a delete confirmation (via `confirm-dialog.tsx`).
5. **Routing:** an `app/(workspace)/board/[boardId]/` route, or a query parameter, that sets the active board.

### Done when

- My board looks and behaves exactly as it does today, with all existing tasks.
- A new board can be created, opened, renamed and deleted, and its tasks never appear on another board.
- Switching boards updates the columns, counts, filters, search, Today/Upcoming and Trash.
- The open board survives a reload, and each board has a working URL.
- Lint, types and the production build pass, and it's checked in the browser in light and dark mode and at phone size.
