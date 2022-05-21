export type ObjRecord = Record<string, any>;

export type Optional<Obj extends ObjRecord> = {
  [Key in keyof Obj]?: Obj[Key];
};
