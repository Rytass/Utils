import { ChildEntity, Column } from 'typeorm';
import { MaterialEntity } from '../src';

@ChildEntity()
export class CustomMaterialEntity extends MaterialEntity {
  @Column('varchar')
  name: string;

  @Column('varchar')
  customField: string;
}

export const materialMock = {
  m1: {
    id: 'M1',
    name: 'Material 1',
    customField: 'Custom Field 1',
  },
  m2: {
    id: 'M2',
    name: 'Material 2',
    customField: 'Custom Field 2',
  },
};
