import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { BaseArticleVersionEntity } from './base-article-version.entity';

export const BaseArticleRepo = Symbol('BaseArticleRepo');

@Entity('articles')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class BaseArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(
    () => BaseArticleVersionEntity,
    (articleVersion) => articleVersion.article,
  )
  versions: Relation<BaseArticleVersionEntity[]>;
}
