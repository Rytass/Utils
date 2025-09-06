// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjRecord = Record<string, any>;

export type OptionalKeys<Obj extends ObjRecord> = {
  [Key in keyof Obj]?: Obj[Key];
};
