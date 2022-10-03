/**
 * OrderCalculateSubject
 *
 * `A subject to manage the snapshot and life cycle.`
 */
export class OrderCalculateSubject<T> {
  private _snapshot: T | undefined;

  public next() {
    this._snapshot = undefined;
  }

  public subscribe<TT extends T>(calculate: () => TT) {
    if (typeof this._snapshot !== 'undefined') return this._snapshot;

    this._snapshot = calculate();

    return this._snapshot;
  }
}
