/**
 * OrderCalculateSubject
 *
 * `A subject to manage the snapshot and life cycle.`
 */
export class OrderCalculateSubject<T> {
  private _snapshot: T | undefined;

  public next(): void {
    this._snapshot = undefined;
  }

  public subscribe<TT extends T>(calculate: () => TT): TT {
    if (typeof this._snapshot !== 'undefined') return this._snapshot as TT;

    this._snapshot = calculate();

    return this._snapshot as TT;
  }
}
