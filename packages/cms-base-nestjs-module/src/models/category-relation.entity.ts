import { Entity, PrimaryColumn } from 'typeorm';

export const CategoryRelationRepo = Symbol('CategoryRelationRepo');

@Entity('category_relations')
export class CategoryRelationEntity {
  @PrimaryColumn('uuid')
  parentId: string;

  @PrimaryColumn('uuid')
  childId: string;
}
