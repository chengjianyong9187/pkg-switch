// ts
export interface SwitchErrorOptions {
  code: string;
  rolledBack?: boolean;
  backupId?: string;
  cause?: unknown;
}

export class SwitchError extends Error {
  readonly code: string;
  readonly rolledBack: boolean;
  readonly backupId?: string;
  readonly cause?: unknown;

  constructor(message: string, options: SwitchErrorOptions) {
    super(message);
    this.name = "SwitchError";
    this.code = options.code;
    this.rolledBack = options.rolledBack ?? false;
    this.backupId = options.backupId;
    this.cause = options.cause;
  }
}
