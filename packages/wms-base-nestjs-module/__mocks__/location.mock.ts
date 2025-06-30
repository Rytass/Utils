import { ChildEntity, Column } from 'typeorm';
import { LocationEntity } from '../src';

@ChildEntity()
export class CustomLocationEntity extends LocationEntity {
  @Column('varchar')
  customField: string;
}

export const locationMock = {
  parent: {
    id: 'Parent',
    customField: 'Top Level',
  },
  child1: {
    id: 'Child1',
    customField: 'customField',
    parentId: 'Parent',
  },
  child2: {
    id: 'Child2',
    customField: 'customField',
    parentId: 'Parent',
  },
  nestedChild: {
    id: 'NestedChild',
    customField: 'customField',
    parentId: 'Child1',
  },
  duplicate: {
    id: 'Duplicate',
    customField: 'Duplicate',
  },
  locationWithStock: {
    id: 'LocationWithStock',
    customField: 'LocationWithStock',
  },
};
