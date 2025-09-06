export type ObjRecord = Record<string, any>;

export type OptionalKeys<Obj extends ObjRecord> = {
  [Key in keyof Obj]?: Obj[Key];
};
