# AGENT GUIDELINES FOR ViteSakuga

ViteSakuga is a fullstack web application built with React 19, TanStack Start, TanStack Router, Better Auth, Kysely, Drizzle ORM, TanStack Form, Zod, Tailwind CSS v4, Chakra UI v3, and Effect V4 emphasizing a client-first, type-safe architecture with full-stack capabilities.

---

## Package Manager

**Never use npm. Always use pnpm.** All commands (install, add, run, exec, dlx, etc.) must be executed using `pnpm`. npm is forbidden in this project.

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
There is also accountability cloned to `~/.local/share/effect-solutions/accountability` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.

## Build, Lint, and Test Commands

### General Commands

- build: vite build
- db: drizzle-kit
- dev: vite dev --mode development
- devprod: vite dev --mode production
- format: oxfmt --write .
- formatcheck: oxfmt --check .
- lint: oxlint . --fix
- lintcheck: oxlint .
- server: vite preview
- start: node run .output/server/index.mjs
- test: vitest -w

### Testing

The project uses `vitest` for testing.

- **Run Tests (watch mode)**: `pnpm test` (runs `vitest -w`)
- **Run All Tests (single pass)**: `vitest`
- **Run a Single Test File**: `vitest <path/to/test-file.test.ts>`
- **Run a Specific Test by Name**: `vitest -t "Test suite name" -t "specific test name"`

### Database Commands (Drizzle Kit)

- **Generate Migrations**: `pnpm db generate` (runs `drizzle-kit generate:pg`)
- **Push Schema Changes**: `pnpm db push` (runs `drizzle-kit push:pg`)
- **Apply Migrations**: `pnpm db migrate` (runs `drizzle-kit migrate`)

## General Code Style Principles

- **Type Safety**: Prioritize strong typing.
- **Consistency**: Adhere to existing patterns and conventions within the codebase.
- **Functional Programming**: Favor pure functions and immutability where appropriate.
- **Error Handling**: Server functions should generally throw errors, allowing callers to handle them. Use `try-catch` blocks sparingly in server functions.

## Detailed Guidelines

For more specific guidelines, refer to the following documents:

- [TypeScript & React Conventions](./docs/typescript-react-conventions.md)
- [Server Functions & API Design](./docs/server-functions-api.md)
- [Database Conventions (Drizzle ORM & Kysely)](./docs/database-conventions.md)
- [Project Structure & File Conventions](./docs/project-structure.md)
- [Feature Implementation Guidelines](./docs/feature-implementation-guidelines.md)
- [Additional Resources](./docs/additional-resources.md)

## Copilot Instructions

The original Copilot instructions from `.github/copilot-instructions.md` are also a valuable reference and should be adhered to for additional context and guidance not explicitly covered here.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `pnpm dlx ultracite fix` before committing to ensure compliance.

## Agent skills

### Issue tracker

Issues live as GitHub Issues on `ozakione/vitesakuga`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
