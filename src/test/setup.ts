import '@testing-library/jest-dom'

// Mock Electron APIs
global.window = global.window || {}

// Mock tipc client
jest.mock('@renderer/lib/tipc-client', () => ({
  tipcClient: {
    loadMcpConfigFile: jest.fn(),
    saveMcpConfigFile: jest.fn(),
    validateMcpConfig: jest.fn(),
    getMcpServerStatus: jest.fn(),
    testMcpServerConnection: jest.fn(),
    restartMcpServer: jest.fn(),
    stopMcpServer: jest.fn(),
    saveConfig: jest.fn(),
    getConfig: jest.fn()
  }
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  }
}))

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/test' })
}))

// Mock query client
jest.mock('@renderer/lib/query-client', () => ({
  useConfigQuery: () => ({
    data: {},
    isLoading: false,
    error: null
  })
}))

// Suppress console warnings in tests
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

beforeAll(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.warn = originalConsoleWarn
  console.error = originalConsoleError
})
