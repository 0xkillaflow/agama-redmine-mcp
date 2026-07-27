// Public API of the domain error model.
export {
  RedmineError,
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineValidationError,
  RedmineRateLimitError,
  RedmineTransportError,
  NotImplementedError,
  isRedmineError,
} from './redmine-errors.js';
export type { RedmineErrorOptions, RateLimitErrorOptions } from './redmine-errors.js';
export { FileAccessError } from './file-access-error.js';
