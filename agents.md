# Agent Guidelines: fms-core TypeScript Library

**Last Updated:** 2025-01-16  
**Project:** fms-core - Modern TypeScript CGMiner API library for Bitcoin miners

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Development Workflow](#development-workflow)
3. [Coding Standards](#coding-standards)
4. [Testing Requirements](#testing-requirements)
5. [Security Guidelines](#security-guidelines)
6. [Code Review Process](#code-review-process)
7. [File Organization](#file-organization)
8. [Documentation Standards](#documentation-standards)

---

## Project Overview

**fms-core** is a zero-dependency TypeScript library for interacting with CGMiner-compatible Bitcoin miners. It provides both general CGMiner API support and Avalon-specific extensions.

### Key Principles

- **Zero Runtime Dependencies**: Keep the library lightweight and dependency-free
- **Type Safety**: Full TypeScript coverage with strict type checking
- **Security First**: Input validation, path traversal protection, DoS prevention
- **Backward Compatibility**: Maintain API stability across versions
- **Well Tested**: Comprehensive unit and integration tests

---

## Development Workflow

### ⚠️ CRITICAL: Pull Request Workflow

**ALL new code MUST be created via Pull Request (PR).**

1. **Create a feature branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following all guidelines below

3. **Test thoroughly** (see [Testing Requirements](#testing-requirements))

4. **Create a Pull Request**:
   - PR title should be descriptive and follow conventional commits format
   - PR description should explain:
     - What changes were made
     - Why the changes were needed
     - How to test the changes
     - Any breaking changes

5. **Wait for code review** before merging

6. **Do NOT commit directly to `master`** unless:
   - Fixing a critical security issue (with immediate review)
   - Updating documentation only (README, comments)
   - Automated changes (dependabot, CI/CD)

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `security/description` - Security fixes
- `docs/description` - Documentation only
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `security`: Security fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**
```
feat(cgminer): add pool switching API

Adds switchPool() method to CGMinerAPI for switching between
mining pools by index.

Closes #123
```

```
security(validation): add IP address validation

Prevents SSRF attacks by validating IP addresses before
making network connections.

BREAKING CHANGE: Invalid IPs now return error results
```

---

## Coding Standards

### TypeScript Style

#### Type Safety

- **NO `any` types** - Use `unknown` and type guards instead
- **Strict null checks** - Always handle `null`/`undefined` explicitly
- **Explicit return types** - Public functions must have explicit return types
- **Use interfaces** - Prefer interfaces over type aliases for object shapes

```typescript
// ✅ Good
function processData(data: unknown): ProcessedData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  // ... process
}

// ❌ Bad
function processData(data: any): any {
  // ...
}
```

#### Naming Conventions

- **Classes**: PascalCase (`CGMinerAPI`, `AUPFile`)
- **Functions/Methods**: camelCase (`getVersion`, `validateIP`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RESPONSE_SIZE`, `DEFAULT_PORT`)
- **Private members**: Prefix with underscore (`_responseDict`, `_prepareUpgradeParam`)
- **Interfaces**: PascalCase, often end with descriptive suffix (`RequestOptions`, `SocketErrorInfo`)

#### Code Organization

- **One class/interface per file** (with exceptions for closely related types)
- **Exports at the end** - Use `export` keyword, not `export default` for main exports
- **Group imports**: Node.js built-ins → external → internal
- **No circular dependencies**

```typescript
// ✅ Good import order
import * as fs from 'fs';
import * as net from 'net';

import { logger } from './logger';
import { validateIP } from './utils';
```

#### Error Handling

- **Use Error objects** - Never throw strings or primitives
- **Specific error types** - Create custom error classes when appropriate
- **Error messages** - Be descriptive but don't leak sensitive information
- **Never log credentials** - Use redaction functions for sensitive data

```typescript
// ✅ Good
if (!validateIP(ip)) {
  return CGMinerAPIResult.errorResult(
    Date.now() / 1000,
    `Invalid IP address format: ${ip}`,
    ERR_CODE_INVALID_INPUT
  );
}

// ❌ Bad
if (!isValidIP(ip)) {
  throw 'Invalid IP';
}
```

#### Async/Await

- **Prefer async/await** over Promises chains
- **Always handle errors** - Use try/catch or `.catch()`
- **Don't mix patterns** - Be consistent within a function

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    logger.error(`Failed to fetch: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ❌ Bad
function fetchData(): Promise<Data> {
  return apiCall().then(result => {
    // ...
  });
}
```

### Security Requirements

#### Input Validation

- **Validate ALL user inputs**:
  - IP addresses (`validateIP()`)
  - Port numbers (`validatePort()`)
  - File paths (`validateFilePath()`)
  - Parameter lengths (max 8KB)
  - Timeout values (clamp to reasonable range)

#### Path Traversal Protection

- **Always use `validateFilePath()`** before file operations
- **Never trust user-provided paths** - Always resolve relative to base directory
- **Reject symlinks** - Use `lstatSync()` to check for symlinks

#### DoS Prevention

- **Buffer size limits** - Enforce `MAX_RESPONSE_SIZE` (10MB)
- **Retry limits** - Cap unlimited retries (`MAX_UNLIMITED_RETRIES = 10`)
- **Parameter length limits** - Reject parameters > 8KB
- **Timeout enforcement** - Always set and respect timeouts

#### Credential Handling

- **Never log passwords** - Use `redactCommandParameters()` for logs
- **Never log raw responses** - Log only status codes and summaries
- **Sanitize file paths** - Use `safeFilenameForLog()` in logs

#### Random Number Generation

- **Use `crypto.randomBytes()`** for cryptographic operations
- **Never use `Math.random()`** for security-sensitive values
- **Use `randomStrOnlyWithAlnumSecure()`** for API request IDs

### Code Comments

- **JSDoc for public APIs** - All exported functions/classes need JSDoc
- **Explain WHY, not WHAT** - Comments should explain reasoning, not restate code
- **Mark deprecated APIs** - Use `@deprecated` tag with migration path
- **Security notes** - Comment on security-sensitive code sections

```typescript
/**
 * Validates an IPv4 address format
 * @param ip IP address string to validate
 * @returns true if valid IPv4 format, false otherwise
 * @throws Error if validation fails (for internal use)
 */
export function validateIP(ip: string): boolean {
  // Implementation
}
```

---

## Testing Requirements

### ⚠️ CRITICAL: All Code Must Be Tested

**Every change MUST include:**

1. **Automated tests** (unit/integration)
2. **Manual testing** (documented in PR description)

### Test Structure

```
tests/
├── *.test.ts              # Unit tests (co-located with source)
├── integration/           # Integration tests
│   └── miners.test.ts    # Real miner tests
└── jest.setup.ts         # Test configuration
```

### Unit Tests

- **Test all public APIs** - Every exported function/class needs tests
- **Test error cases** - Invalid inputs, network failures, timeouts
- **Test edge cases** - Empty strings, null values, boundary conditions
- **Mock external dependencies** - Use Jest mocks for network/file operations

**Example:**
```typescript
describe('validateIP', () => {
  it('should accept valid IPv4 addresses', () => {
    expect(validateIP('192.168.1.1')).toBe(true);
    expect(validateIP('10.0.0.1')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(validateIP('not.an.ip')).toBe(false);
    expect(validateIP('256.1.1.1')).toBe(false);
    expect(validateIP('')).toBe(false);
  });
});
```

### Integration Tests

- **Test against real miners** (when available)
- **Use environment variables** for miner IPs (`MINER_1_IP`, etc.)
- **Skip if miners unavailable** - Use `INTEGRATION_TESTS=true` flag
- **Clean up after tests** - Don't leave miners in bad state

### Manual Testing Checklist

For each PR, document manual testing:

- [ ] **Functionality**: Feature works as expected
- [ ] **Error handling**: Invalid inputs handled gracefully
- [ ] **Edge cases**: Boundary conditions tested
- [ ] **Performance**: No significant performance regression
- [ ] **Security**: Input validation works, no sensitive data leaked
- [ ] **Documentation**: Examples in README work correctly

### Test Coverage

- **Minimum 80% coverage** for new code
- **100% coverage** for security-critical functions
- **Run coverage**: `npm run test:coverage`
- **Review coverage report** before submitting PR

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests (requires INTEGRATION_TESTS=true)
npm run test:integration

# Watch mode
npm run test:watch
```

---

## Security Guidelines

### Security Review Checklist

Before submitting PR, verify:

- [ ] **Input validation** - All user inputs validated
- [ ] **Path traversal** - File paths validated and resolved
- [ ] **DoS protection** - Buffer/retry/timeout limits enforced
- [ ] **Credential handling** - No passwords/secrets in logs
- [ ] **Secure random** - `crypto.randomBytes()` for security-sensitive values
- [ ] **Error messages** - Don't leak sensitive information
- [ ] **Dependencies** - No new runtime dependencies added

### Security-Focused Code Review

When reviewing PRs, check:

1. **Input validation** - Are all inputs validated?
2. **Error handling** - Are errors handled securely?
3. **Logging** - Are sensitive values redacted?
4. **File operations** - Are paths validated?
5. **Network operations** - Are IPs/ports validated?
6. **Resource limits** - Are DoS protections in place?

---

## Code Review Process

### PR Review Checklist

**For Authors:**

- [ ] Code follows style guide
- [ ] All tests pass (`npm test`)
- [ ] Coverage meets minimum (80%)
- [ ] Manual testing documented
- [ ] Security checklist completed
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or documented if intentional)
- [ ] Changeset created (if needed)

**For Reviewers:**

- [ ] Code is readable and maintainable
- [ ] Tests are comprehensive
- [ ] Security considerations addressed
- [ ] Performance impact acceptable
- [ ] Documentation is accurate
- [ ] No unnecessary dependencies
- [ ] Follows project conventions

### Review Guidelines

- **Be constructive** - Provide actionable feedback
- **Ask questions** - Don't assume intent
- **Approve when ready** - Don't block on minor issues
- **Request changes** - For security issues or breaking changes
- **Test locally** - Run tests before approving

---

## File Organization

### Directory Structure

```
fms-core/
├── src/                    # Source code
│   ├── *.ts               # Main source files
│   └── ...
├── dist/                   # Compiled output (gitignored)
├── tests/                  # Test files
│   ├── *.test.ts          # Unit tests
│   └── integration/       # Integration tests
├── scripts/                # Build/test scripts
├── .github/                # GitHub workflows
│   └── workflows/
├── .changeset/             # Changeset files
└── docs/                   # Additional documentation
```

### File Naming

- **Source files**: kebab-case (`cg-miner-api.ts`, `aup-file.ts`)
- **Test files**: Match source + `.test.ts` (`cg-miner-api.test.ts`)
- **Scripts**: kebab-case (`test-miners.ts`, `diagnose-miner.ts`)

### Export Organization

- **Main exports**: `src/index.ts` - Re-exports all public APIs
- **Avalon exports**: `src/avalon.ts` - Avalon-specific features
- **Type exports**: `src/cgminer-types.ts` - TypeScript interfaces

---

## Documentation Standards

### README.md

- **Keep updated** - Update README with new features
- **Include examples** - Show how to use new APIs
- **Link to docs** - Reference detailed documentation
- **Security notes** - Mention security considerations

### Code Documentation

- **JSDoc for public APIs** - All exported functions/classes
- **Inline comments** - For complex logic or security-sensitive code
- **Type annotations** - Self-documenting code preferred

### Changesets

- **Create changeset** for user-facing changes
- **Use descriptive messages** - Explain what changed and why
- **Mark breaking changes** - Use `BREAKING CHANGE:` footer

---

## Additional Guidelines

### Dependencies

- **Zero runtime dependencies** - Keep library lightweight
- **Dev dependencies OK** - For build/test tooling only
- **No peer dependencies** - Library should work standalone
- **Audit dependencies** - Run `npm audit` regularly

### Performance

- **Avoid premature optimization** - Write clear code first
- **Profile before optimizing** - Measure actual performance
- **Consider memory usage** - Especially for buffer operations
- **Set reasonable limits** - Prevent resource exhaustion

### Git Workflow

- **Small, focused commits** - One logical change per commit
- **Rebase before PR** - Keep history clean
- **Squash merge** - For feature branches
- **No force push to master** - Protect main branch

### CI/CD

- **All PRs must pass CI** - Build and tests must pass
- **Automated publishing** - On merge to master (if version changed)
- **Changesets** - Automated changelog generation

---

## Quick Reference

### Before Submitting PR

```bash
# 1. Run tests
npm test

# 2. Check coverage
npm run test:coverage

# 3. Build
npm run build

# 4. Lint (if configured)
npm run lint

# 5. Create changeset (if needed)
npm run changeset
```

### Common Commands

```bash
# Development
npm run build          # Compile TypeScript
npm run dev            # Watch mode
npm test               # Run tests
npm run test:watch     # Watch mode tests
npm run test:coverage  # Coverage report

# Testing scripts
npm run test:miners    # Test against real miners
npm run test:pools     # Test pool commands
npm run diagnose:miner # Diagnose connection issues
```

---

## Questions or Issues?

- **Security issues**: Create a security advisory on GitHub
- **Bug reports**: Open an issue with reproduction steps
- **Feature requests**: Open an issue with use case
- **Questions**: Open a discussion or ask in PR comments

---

**Remember**: Code quality, security, and testing are not optional. Every change should improve the library while maintaining its reliability and security posture.
