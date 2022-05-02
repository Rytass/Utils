export abstract class SecretManager {
  private readonly _project: string;

  public constructor(project: string) {
    this._project = project;
  }

  get project(): string {
    return this._project;
  }

  public abstract get<T>(key: string): Promise<T> | T;

  public abstract set<T>(key: string, value: T): Promise<void> | void;

  public abstract delete(key: string): Promise<void> | void;
}
