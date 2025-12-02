# Vitest - Next Generation Testing Framework

Vitest is a blazing-fast unit testing framework powered by Vite, designed for modern JavaScript and TypeScript projects. It provides a Jest-compatible API with native ES modules support, instant hot module replacement (HMR) for tests, and a unified configuration system that integrates seamlessly with Vite. Vitest leverages Vite's transformation pipeline to execute tests at remarkable speeds while offering comprehensive features including snapshot testing, code coverage, mocking, browser mode, and parallel test execution. Vitest requires Vite >=v6.0.0 and Node >=v20.0.0.

As a Vite-native testing solution, Vitest eliminates the configuration overhead typically associated with traditional testing frameworks. It automatically inherits your Vite configuration, plugins, and transformers, ensuring your tests run in an environment that mirrors your application. The framework supports multiple execution environments (Node.js, JSDOM, Happy-DOM, browser), sophisticated mocking capabilities, TypeScript out-of-the-box, and advanced features like multi-project configurations, benchmarking, and type-level testing. With its modern architecture and developer-focused design, Vitest has become the go-to testing framework for Vite-based projects and is rapidly gaining adoption across the JavaScript ecosystem.

## Test Definition APIs

### describe - Group Related Tests
Creates a test suite that groups multiple related tests together with shared setup and teardown logic.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Math operations', () => {
  let value: number

  beforeEach(() => {
    value = 10
  })

  afterEach(() => {
    // cleanup
  })

  it('should add numbers correctly', () => {
    expect(value + 5).toBe(15)
  })

  it('should multiply numbers correctly', () => {
    expect(value * 2).toBe(20)
  })

  describe('nested suite', () => {
    it('can nest suites', () => {
      expect(Math.sqrt(value)).toBe(Math.sqrt(10))
    })
  })
})
```

### test/it - Define Individual Tests
Define individual test cases with descriptive names and assertions.

```typescript
import { test, it, expect, assert } from 'vitest'

// Using test
test('Math.sqrt() calculates square root', () => {
  expect(Math.sqrt(4)).toBe(2)
  expect(Math.sqrt(144)).toBe(12)
  expect(Math.sqrt(2)).toBe(Math.SQRT2)
})

// Using it (alias for test)
it('JSON serialization works correctly', () => {
  const input = {
    foo: 'hello',
    bar: 'world',
  }

  const output = JSON.stringify(input)

  expect(output).eq('{"foo":"hello","bar":"world"}')
  assert.deepEqual(JSON.parse(output), input, 'matches original')
})

// Concurrent tests
test.concurrent('runs in parallel 1', async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(true).toBe(true)
})

test.concurrent('runs in parallel 2', async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(true).toBe(true)
})

// Conditional tests
test.skipIf(process.platform === 'win32')('Unix-only test', () => {
  expect(process.platform).not.toBe('win32')
})

test.runIf(process.env.ENABLE_INTEGRATION)('Integration test', async () => {
  // runs only if environment variable is set
})
```

## Assertion APIs

### expect - Main Assertion API
Vitest's primary assertion library with Jest-compatible matchers built on Chai.

```typescript
import { expect } from 'vitest'

// Equality matchers
expect(1 + 1).toBe(2)
expect({ a: 1 }).toEqual({ a: 1 })
expect({ a: 1, b: { c: 2 } }).toStrictEqual({ a: 1, b: { c: 2 } })

// Truthiness matchers
expect(true).toBeTruthy()
expect(false).toBeFalsy()
expect(null).toBeNull()
expect(undefined).toBeUndefined()
expect('value').toBeDefined()

// Number matchers
expect(10).toBeGreaterThan(5)
expect(10).toBeGreaterThanOrEqual(10)
expect(5).toBeLessThan(10)
expect(5).toBeLessThanOrEqual(5)
expect(0.1 + 0.2).toBeCloseTo(0.3)

// String matchers
expect('hello world').toMatch(/world/)
expect('testing').toContain('test')

// Array/Object matchers
expect([1, 2, 3]).toContain(2)
expect([1, 2, 3]).toContainEqual(2)
expect([{ a: 1 }, { b: 2 }]).toContainEqual({ a: 1 })
expect({ a: 1, b: 2 }).toHaveProperty('a')
expect({ a: 1, b: 2 }).toHaveProperty('a', 1)
expect({ a: { b: 1 } }).toMatchObject({ a: { b: 1 } })

// Exception matchers
expect(() => {
  throw new Error('failure')
}).toThrow('failure')
expect(() => {
  throw new Error('failure')
}).toThrow(Error)

// Negation
expect(1 + 1).not.toBe(3)

// Async matchers
await expect(Promise.resolve('value')).resolves.toBe('value')
await expect(Promise.reject(new Error('fail'))).rejects.toThrow('fail')

// Snapshot testing
expect({ foo: 'bar', timestamp: Date.now() }).toMatchSnapshot({
  timestamp: expect.any(Number), // matcher for dynamic values
})
expect('<div>Hello World</div>').toMatchInlineSnapshot(`"<div>Hello World</div>"`)
```

### expect.poll - Wait for Assertions
Poll a condition until it passes or times out, useful for testing async operations.

```typescript
import { expect, test } from 'vitest'

test('waits for value to update', async () => {
  let value = 0

  setTimeout(() => {
    value = 10
  }, 100)

  // Polls every 50ms (default) until timeout (1000ms default)
  await expect.poll(() => value).toBe(10)
})

test('custom polling configuration', async () => {
  let counter = 0
  const interval = setInterval(() => counter++, 50)

  try {
    await expect.poll(
      () => counter,
      {
        timeout: 2000,  // wait up to 2 seconds
        interval: 100,  // check every 100ms
        message: 'Counter did not reach 5'
      }
    ).toBeGreaterThanOrEqual(5)
  } finally {
    clearInterval(interval)
  }
})
```

### Asymmetric Matchers
Use asymmetric matchers for partial matching in complex objects.

```typescript
import { expect } from 'vitest'

expect({ name: 'John', age: 30, id: 'abc123' }).toEqual({
  name: 'John',
  age: expect.any(Number),
  id: expect.stringMatching(/^[a-z0-9]+$/),
})

expect([1, 2, 3, 4, 5]).toEqual(
  expect.arrayContaining([2, 4])
)

expect({ a: 1, b: 2, c: 3 }).toEqual(
  expect.objectContaining({ a: 1, b: 2 })
)

// Combining asymmetric matchers
expect({
  user: { id: 123, name: 'Alice', email: 'alice@example.com' },
  timestamp: 1234567890,
  status: 'active',
}).toMatchObject({
  user: expect.objectContaining({
    name: expect.any(String),
    email: expect.stringContaining('@'),
  }),
  timestamp: expect.any(Number),
})
```

## Mocking APIs

### vi.fn() - Create Mock Functions
Create mock functions to track calls, arguments, and return values.

```typescript
import { vi, test, expect } from 'vitest'

test('mock function basics', () => {
  const mockFn = vi.fn()

  mockFn('hello', 123)
  mockFn('world')

  expect(mockFn).toHaveBeenCalledTimes(2)
  expect(mockFn).toHaveBeenCalledWith('hello', 123)
  expect(mockFn).toHaveBeenLastCalledWith('world')
  expect(mockFn.mock.calls).toEqual([
    ['hello', 123],
    ['world']
  ])
})

test('mock implementation', () => {
  const getApples = vi.fn(() => 42)

  expect(getApples()).toBe(42)
  expect(getApples).toHaveReturnedWith(42)

  // Change implementation
  getApples.mockReturnValueOnce(10)
  getApples.mockReturnValue(5)

  expect(getApples()).toBe(10)
  expect(getApples()).toBe(5)
  expect(getApples()).toBe(5)
})

test('mock implementation with async', async () => {
  const fetchUser = vi.fn()

  fetchUser.mockResolvedValueOnce({ id: 1, name: 'Alice' })
  fetchUser.mockRejectedValueOnce(new Error('Network error'))

  const user = await fetchUser()
  expect(user).toEqual({ id: 1, name: 'Alice' })

  await expect(fetchUser()).rejects.toThrow('Network error')
})
```

### vi.spyOn() - Spy on Object Methods
Spy on existing methods while preserving or replacing their behavior.

```typescript
import { vi, test, expect } from 'vitest'

test('spy on method', () => {
  const cart = {
    getApples: () => 42,
    getBananas: () => 10,
  }

  const spy = vi.spyOn(cart, 'getApples').mockReturnValue(100)

  expect(cart.getApples()).toBe(100)
  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith(100)

  spy.mockRestore()
  expect(cart.getApples()).toBe(42)
})

test('spy on property getter', () => {
  const obj = {
    get value() {
      return 42
    }
  }

  const spy = vi.spyOn(obj, 'value', 'get').mockReturnValue(100)

  expect(obj.value).toBe(100)
  expect(spy).toHaveBeenCalled()
})
```

### vi.mock() - Mock Modules
Mock entire modules with custom implementations.

```typescript
import { vi, test, expect, beforeEach } from 'vitest'

// Automatic mock
vi.mock('./database')

// Manual mock with factory
vi.mock('./api', () => ({
  fetchUser: vi.fn(() => ({ id: 1, name: 'Test User' })),
  fetchPosts: vi.fn(() => []),
}))

// Partial mock - preserve some real exports
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    someFunction: vi.fn(), // override this one
  }
})

test('using mocked module', async () => {
  const { fetchUser } = await import('./api')

  const user = await fetchUser(123)

  expect(fetchUser).toHaveBeenCalledWith(123)
  expect(user).toEqual({ id: 1, name: 'Test User' })
})
```

### vi.useFakeTimers() - Mock Time
Control time and timers for testing time-dependent code.

```typescript
import { vi, test, expect, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('advance timers by time', () => {
  const callback = vi.fn()

  setTimeout(callback, 1000)

  expect(callback).not.toHaveBeenCalled()

  vi.advanceTimersByTime(500)
  expect(callback).not.toHaveBeenCalled()

  vi.advanceTimersByTime(500)
  expect(callback).toHaveBeenCalledOnce()
})

test('run all timers', () => {
  const callback1 = vi.fn()
  const callback2 = vi.fn()

  setTimeout(callback1, 100)
  setTimeout(callback2, 200)

  vi.runAllTimers()

  expect(callback1).toHaveBeenCalled()
  expect(callback2).toHaveBeenCalled()
})

test('mock system time', () => {
  const now = new Date('2024-01-01T00:00:00Z')
  vi.setSystemTime(now)

  expect(Date.now()).toBe(now.getTime())
  expect(new Date().toISOString()).toBe('2024-01-01T00:00:00.000Z')
})
```

### vi.waitFor() - Wait for Async Conditions
Wait for asynchronous operations to complete with retry logic.

```typescript
import { vi, test, expect } from 'vitest'

test('wait for server to be ready', async () => {
  const server = {
    isReady: false,
    start: async () => {
      setTimeout(() => {
        server.isReady = true
      }, 100)
    }
  }

  await server.start()

  await vi.waitFor(
    () => {
      if (!server.isReady) {
        throw new Error('Server not ready')
      }
    },
    {
      timeout: 1000, // max wait time
      interval: 20,  // check interval
    }
  )

  expect(server.isReady).toBe(true)
})

test('wait until condition is truthy', async () => {
  let element = null

  setTimeout(() => {
    element = { id: 'test', text: 'Hello' }
  }, 50)

  const result = await vi.waitUntil(
    () => element,
    { timeout: 500, interval: 10 }
  )

  expect(result).toEqual({ id: 'test', text: 'Hello' })
})
```

## Configuration API

### defineConfig - Define Vitest Configuration
Configure Vitest with TypeScript support and IntelliSense.

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test file patterns
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Environment
    environment: 'node', // 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime'
    globals: true, // inject test APIs globally

    // Execution
    pool: 'forks', // 'threads' | 'forks' | 'vmThreads' | 'vmForks' (default: 'forks')
    fileParallelism: true,
    maxWorkers: 4,
    testTimeout: 5000,
    hookTimeout: 10000,

    // Reporters
    reporters: ['default', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-results/index.html',
    },

    // Coverage
    coverage: {
      provider: 'v8', // 'v8' | 'istanbul'
      enabled: false,
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    // Setup files
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],

    // Mocking behavior
    clearMocks: true,
    restoreMocks: true,

    // Snapshots
    update: false,

    // Sequencing
    sequence: {
      shuffle: false,
      concurrent: false,
      seed: Date.now(),
      hooks: 'stack', // 'stack' | 'list' | 'parallel'
    },
  },
})
```

### Multiple Environments Per File
Specify different test environments using docblock comments.

```typescript
/**
 * @vitest-environment jsdom
 */
import { test, expect } from 'vitest'

test('DOM environment is available', () => {
  const element = document.createElement('div')
  element.textContent = 'Hello World'

  expect(element.tagName).toBe('DIV')
  expect(element.textContent).toBe('Hello World')
  expect(document.body).toBeDefined()
})
```

### Projects Configuration - Multiple Projects
Configure multiple test projects with different settings using the `projects` configuration.

```typescript
import { defineConfig, defineProject } from 'vitest/config'

// Using inline project configurations
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          environment: 'jsdom',
          include: ['src/**/*.browser.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000,
          pool: 'forks',
        },
      },
    ],
  },
})

// Using glob patterns to reference project configs
export default defineConfig({
  test: {
    projects: ['packages/*', 'tests/integration'],
  },
})

// Individual project config file using defineProject
// packages/a/vitest.config.ts
export default defineProject({
  test: {
    environment: 'jsdom',
    name: 'package-a',
  },
})
```

## Lifecycle Hooks

### beforeEach/afterEach - Per-Test Setup
Run setup and cleanup code before and after each test.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Database tests', () => {
  let db: Database

  beforeEach(async () => {
    // Runs before each test
    db = await createTestDatabase()
    await db.seed()
  })

  afterEach(async () => {
    // Runs after each test
    await db.cleanup()
    await db.close()
  })

  it('inserts records', async () => {
    await db.insert({ name: 'Alice' })
    const records = await db.findAll()
    expect(records).toHaveLength(1)
  })

  it('updates records', async () => {
    const id = await db.insert({ name: 'Bob' })
    await db.update(id, { name: 'Charlie' })
    const record = await db.findById(id)
    expect(record.name).toBe('Charlie')
  })
})
```

### beforeAll/afterAll - Per-Suite Setup
Run setup and cleanup code once per suite.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Server tests', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    // Runs once before all tests in suite
    server = await startServer({ port: 0 })
    baseUrl = `http://localhost:${server.port}`
  })

  afterAll(async () => {
    // Runs once after all tests in suite
    await server.close()
  })

  it('GET /health returns 200', async () => {
    const response = await fetch(`${baseUrl}/health`)
    expect(response.status).toBe(200)
  })

  it('GET /api/users returns array', async () => {
    const response = await fetch(`${baseUrl}/api/users`)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })
})
```

### onTestFinished/onTestFailed - Test Result Hooks
Register callbacks to run after test completion or on test failure.

```typescript
import { test, expect, onTestFinished, onTestFailed } from 'vitest'

test('database query with cleanup', () => {
  const db = connectDb()

  // Always runs after test finishes (pass or fail)
  onTestFinished(() => {
    db.close()
  })

  // Only runs if test fails - useful for debugging
  onTestFailed(({ task }) => {
    console.log('Test failed:', task.name)
    console.log('Errors:', task.result.errors)
  })

  db.query('SELECT * FROM users')
})

// For concurrent tests, use hooks from test context
test.concurrent('concurrent test', ({ onTestFinished, onTestFailed }) => {
  const resource = allocateResource()

  onTestFinished(() => {
    resource.cleanup()
  })

  onTestFailed(() => {
    console.log('Concurrent test failed')
  })

  expect(true).toBe(true)
})
```

## Test Context and Fixtures

### Test Context - Access Test Information
Access test metadata and utilities within tests.

```typescript
import { test, expect } from 'vitest'

test('test context', ({ task }) => {
  console.log('Test name:', task.name)
  console.log('Test file:', task.file.name)
  console.log('Test mode:', task.mode) // 'run' | 'skip' | 'only'
})

test.extend({
  // Define custom fixtures
  user: async ({}, use) => {
    const user = await createUser({ name: 'Test User' })
    await use(user)
    await deleteUser(user.id)
  },
  database: async ({}, use) => {
    const db = await createDatabase()
    await use(db)
    await db.close()
  },
})('test with fixtures', async ({ user, database }) => {
  await database.insert('users', user)
  const found = await database.find('users', user.id)
  expect(found).toEqual(user)
})
```

## CLI Commands

### Run Tests
Execute tests with various options and filters.

```bash
# Run all tests
npx vitest

# Run in watch mode (default in dev)
npx vitest --watch

# Run once and exit
npx vitest run

# Run specific files
npx vitest src/utils.test.ts src/api.test.ts

# Run tests matching pattern
npx vitest --grep="user authentication"
npx vitest -t "should validate email"

# Run with coverage
npx vitest --coverage

# Run in UI mode
npx vitest --ui

# Run tests in specific project
npx vitest --project=unit

# Run with custom config
npx vitest --config=vitest.custom.config.ts

# Update snapshots
npx vitest -u
npx vitest --update

# Run in different environment
npx vitest --environment=jsdom

# Run with specific reporter
npx vitest --reporter=verbose
npx vitest --reporter=json --reporter=html

# Parallel execution control
npx vitest --no-file-parallelism
npx vitest --max-workers=2
npx vitest --pool=threads

# Filter and scope
npx vitest --changed # only changed files
npx vitest --shard=1/3 # run shard 1 of 3
npx vitest --sequence.shuffle # randomize test order
```

## Benchmarking

### bench - Performance Benchmarks

Create performance benchmarks to measure code execution time.

```typescript
import { bench, describe } from 'vitest'

describe('Array performance', () => {
  bench('Array.push', () => {
    const arr = []
    for (let i = 0; i < 1000; i++) {
      arr.push(i)
    }
  })

  bench('Array spread', () => {
    let arr = []
    for (let i = 0; i < 1000; i++) {
      arr = [...arr, i]
    }
  })

  bench('Array.concat', () => {
    let arr = []
    for (let i = 0; i < 1000; i++) {
      arr = arr.concat([i])
    }
  })
})

// Run benchmarks
// npx vitest bench
```

## Type Testing

### expectTypeOf - Type-Level Assertions
Test TypeScript types at compile time.

```typescript
import { expectTypeOf, test } from 'vitest'

test('type checking', () => {
  expectTypeOf({ a: 1, b: 'test' }).toEqualTypeOf<{ a: number; b: string }>()

  expectTypeOf('hello').toBeString()
  expectTypeOf(123).toBeNumber()
  expectTypeOf(true).toBeBoolean()
  expectTypeOf<number>().not.toBeString()

  expectTypeOf([1, 2, 3]).toMatchTypeOf<number[]>()
  expectTypeOf<{ a: number; b?: string }>().toMatchTypeOf<{ a: number }>()

  const func = (a: number, b: string) => ({ result: a + b.length })
  expectTypeOf(func).toBeFunction()
  expectTypeOf(func).parameter(0).toBeNumber()
  expectTypeOf(func).parameter(1).toBeString()
  expectTypeOf(func).returns.toEqualTypeOf<{ result: number }>()
})

// Compile-only type tests (in .test-d.ts files)
import { assertType } from 'vitest'

assertType<number>(123)
assertType<string>('hello')
// @ts-expect-error - should fail type check
assertType<number>('not a number')
```

## Browser Mode

### Browser Testing Configuration
Run tests in real browsers for true integration testing.

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chrome', // 'chrome' | 'firefox' | 'safari' | 'edge'
      provider: 'playwright', // 'playwright' | 'webdriverio'
      headless: true,

      // Viewport
      viewport: {
        width: 1280,
        height: 720,
      },

      // Screenshots on failure
      screenshotFailures: true,

      // Browser-specific options
      providerOptions: {
        launch: {
          devtools: false,
        },
      },
    },
  },
})
```

---

Vitest represents a paradigm shift in JavaScript testing by deeply integrating with Vite's transformation pipeline. Its primary use cases span unit testing for libraries and applications, integration testing with real browser environments, performance benchmarking, and type-level testing. The framework excels in projects using Vite, Vue, React, Svelte, or any modern ESM-based codebase, providing instant feedback through HMR and eliminating the slow compilation cycles of traditional test runners.

The integration patterns center around leveraging Vite's existing configuration, making migration from Jest straightforward while offering superior performance. Vitest seamlessly works with popular tools like Testing Library for component testing, MSW for API mocking, and Playwright/WebDriver for browser automation. Its projects feature enables monorepo testing with per-package configurations, while the plugin system allows extending functionality through custom reporters, matchers, and test runners. With native TypeScript support, comprehensive coverage reporting, and a thriving ecosystem, Vitest has established itself as the modern standard for testing JavaScript applications.