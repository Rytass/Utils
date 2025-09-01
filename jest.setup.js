// Jest setup file to configure test environment
// This file runs before all tests to set up global configuration

// Ensure NGROK_AUTHTOKEN is available for all tests
// This is needed because payment adapter tests check for this environment variable
// even though ngrok should be mocked in tests
if (!process.env.NGROK_AUTHTOKEN) {
  // Set a test token for mocked ngrok tests
  process.env.NGROK_AUTHTOKEN = 'test-token-for-mocked-ngrok-tests';
}