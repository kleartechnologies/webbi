/**
 * Refusals from the admin guard. Every refusal is the same generic 404, so a
 * caller can't tell a missing role from a wrong host or a disabled panel.
 */
export class AdminNotFoundError extends Error {
  constructor() {
    super("Not found.");
    this.name = "AdminNotFoundError";
  }
}

/** A well-formed request the data can't answer, e.g. a cursor for a document that is gone. Only after authorization. */
export class AdminBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminBadRequestError";
  }
}

/** Firebase Auth couldn't be asked about the caller. Only reachable with a valid owner token. */
export class AdminUnavailableError extends Error {
  constructor() {
    super("The admin panel can't check your account right now. Try again shortly.");
    this.name = "AdminUnavailableError";
  }
}
