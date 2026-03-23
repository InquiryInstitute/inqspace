# GitHub Classroom Support for inQspace

A TypeScript-based system that enables instructors to create and manage courses using GitHub Organizations, with students forking assignment repositories similar to GitHub Classroom workflows.

## Project Structure

```
.
├── src/
│   ├── types/              # TypeScript type definitions
│   │   ├── models.ts       # Core data models
│   │   ├── services.ts     # Service interfaces
│   │   ├── repositories.ts # Repository interfaces
│   │   └── index.ts        # Type exports
│   ├── services/           # Application layer services
│   ├── repositories/       # Data layer repositories
│   ├── integration/        # Integration layer (GitHub, Google, etc.)
│   └── database/           # Database schemas and migrations
│       ├── schema.sql      # Complete database schema
│       └── migrations/     # Database migration files
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Jest test configuration
├── .eslintrc.json          # ESLint configuration
└── .prettierrc.json        # Prettier configuration
```

## Architecture

The system follows a three-tier architecture:

1. **Integration Layer**: Abstracts external services (GitHub API, Google Workspace)
2. **Application Layer**: Business logic and service orchestration
3. **Data Layer**: Data persistence and repository pattern

## Data Models

- **Course**: Academic offering associated with a GitHub Organization
- **Assignment**: Repository template for student coursework
- **Fork**: Student's copy of an assignment repository
- **User**: Students, instructors, and administrators
- **Submission**: Student's assignment submission via pull request
- **Notification**: System notifications for events
- **AuthToken**: Authentication credentials (encrypted)
- **DevcontainerConfig**: Development environment configuration

## GCP: code-server on Cloud Run

Browser-based VS Code (code-server) for courses — **Dockerfile, Cloud Build, deploy scripts**, and the **aipa-lecturer-bridge** extension live under **`infra/code-server-gcp/`** and **`extensions/aipa-lecturer-bridge/`**. See **[infra/code-server-gcp/README.md](infra/code-server-gcp/README.md)** for local deploy, `TRUSTED_ORIGINS`, and GitHub Actions.

## Setup

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```

## Database Setup

The database schema is defined in `src/database/schema.sql`. Migrations are located in `src/database/migrations/`.

To apply migrations, use your preferred database migration tool or execute the SQL files directly.

## Development

This project uses:
- **TypeScript** for type safety
- **Jest** for testing (unit and property-based tests)
- **fast-check** for property-based testing
- **ESLint** for code linting
- **Prettier** for code formatting

## Testing Strategy

The project employs both unit testing and property-based testing:

- **Unit Tests**: Verify specific examples and edge cases
- **Property Tests**: Verify universal properties across randomized inputs (minimum 100 iterations)

## Requirements

- Node.js 18+
- TypeScript 5.3+
- Database (MySQL/PostgreSQL compatible)

## License

MIT
