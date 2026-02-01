## Trello-style Kanban Board

This is a lightweight Trello clone: a kanban-style board with multiple boards, lists, and cards, built in plain HTML/CSS/JavaScript.

### Features

- **Boards**: Create multiple boards and switch between them.
- **Lists**: Add, rename, and delete lists inside a board.
- **Cards**: Add, edit, delete cards with title and description.
- **Drag & drop**: Reorder cards within a list and move them between lists.
- **Persistence**: State is saved to `localStorage` so it survives page reloads.

### Getting started

1. **Install dependencies (optional)**  
   From the project root:

   ```bash
   cd "/Users/Jamie.Mossahebi/Desktop/Cursor Test"
   npm install
   ```

2. **Run a static file server**  
   The `package.json` includes a simple script that uses `serve` via `npx`:

   ```bash
   npm run start
   ```

   That will host the folder and show you the URL in the terminal (e.g. `http://localhost:3000`).

3. **Or just open the file directly**  
   You can also open `index.html` directly in your browser (no build step required).

### Notes

- All data is stored in `localStorage` under the key `trelloCloneState.v1`.  
- To reset the app, clear your browser storage for this origin or call `localStorage.removeItem("trelloCloneState.v1")` in DevTools.


