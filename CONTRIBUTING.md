# Contributing to Database Studio

## Prerequisites

- [Node.js](https://nodejs.org/) 20.x or higher
- [VS Code](https://code.visualstudio.com/) 1.85.0 or higher

## Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/CharlieGitDB/database-studio.git
   cd database-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Press **F5** in VS Code to launch the Extension Development Host with the extension loaded.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Build the extension |
| `npm run watch` | Build and watch for changes |
| `npm run package` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run create-vsix` | Package as a `.vsix` for local installation |

## Project Structure

```
src/
├── extension.ts          # Extension entry point
├── clients/              # Database client implementations
├── panels/               # Webview panels (data viewer, query builder)
├── providers/            # Tree view providers
└── test/                 # Tests
```

## Packaging

To create a `.vsix` file for local installation or distribution:

```bash
npm run create-vsix
```

Then install it in VS Code with:

```bash
code --install-extension database-studio-reswob-<version>.vsix
```
