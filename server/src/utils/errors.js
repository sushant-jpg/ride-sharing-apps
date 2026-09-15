export class AppError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function check(condition, status, message, code) {
  if (!condition) throw new AppError(status, message, code);
}
