import { ObjRecord } from '../typings';

type List<T> = ArrayLike<T>;

interface Dictionary<T> {
  [index: string]: T;
}

export function groupBy<Obj extends ObjRecord, Key extends any>(
  collection: List<Obj>,
  iteratee: (iterator: Obj) => Key,
): Dictionary<Obj[]> {
  const reflections = new Map<Key, Obj[]>();

  Array.from(collection).forEach((it) => {
    const key = iteratee(it);

    const restoredIterators = reflections.get(key) || [];

    restoredIterators.push(it);
    reflections.set(key, restoredIterators);
  });

  return Object.fromEntries(reflections);
}
