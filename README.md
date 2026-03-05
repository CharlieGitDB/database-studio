# Database Studio by Reswob

Manage all your databases directly from VS Code. Connect to **Redis**, **MySQL**, **PostgreSQL**, and **MongoDB** — browse data, edit records, and build queries without leaving your editor.

## Features

### Multi-Database Support
Connect to all major database types from a single sidebar panel:
- **Redis** — Browse and manage keys across all data types
- **MySQL** — Explore schemas, tables, and records
- **PostgreSQL** — Explore schemas, tables, and records
- **MongoDB** — Navigate collections and documents

### Browse & Edit Data
- View table data, collection documents, and key values in a clean, readable grid
- Edit records inline — click a row, make your changes, and save
- Delete records with a confirmation step to prevent accidents
- Paginate through large datasets with ease

### Visual SQL Query Builder (MySQL & PostgreSQL)
Build queries visually without writing SQL by hand:
- **Select columns** with optional aggregate functions (COUNT, SUM, AVG, MIN, MAX)
- **Filter results** with a full set of WHERE operators (=, !=, <, >, LIKE, IN, IS NULL, and more)
- **Join tables** with automatic foreign key detection — related tables are suggested for you
- **Sort results** with multi-column ORDER BY
- **Limit & paginate** with LIMIT and OFFSET controls
- **Live SQL preview** — see the generated query update in real-time as you build it
- **Save & reuse queries** — save query templates and load them later

### Connection Management
- Add, edit, and remove connections from the sidebar
- Connect and disconnect with a single click
- Connections persist across VS Code sessions

## Getting Started

1. Open the **Database Studio** panel in the activity bar (sidebar)
2. Click the **+** icon to add a new database connection
3. Enter your connection details and connect
4. Browse your databases, tables, and keys from the tree view
5. Click any table or collection to view its data

## Requirements

- VS Code 1.85.0 or higher

## License

GPL-3.0 — [View on GitHub](https://github.com/CharlieGitDB/database-studio)
