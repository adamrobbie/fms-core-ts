import { logger, LogLevel } from '../src/logger';

// Keep unit test output clean by default. Individual tests can override if needed.
logger.setLevel(LogLevel.NONE);

