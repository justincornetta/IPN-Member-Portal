/** Expected read failures render a retry state without showing an empty dataset. */
export class DataReadError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}
