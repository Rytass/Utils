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
    key: 'Parent',
    customField: 'Top Level',
  },
  child1: {
    id: 'Child1',
    key: 'Child1',
    customField: 'customField',
    parentId: 'Parent',
  },
  child2: {
    id: 'Child2',
    key: 'Child2',
    customField: 'customField',
    parentId: 'Parent',
  },
  nestedChild: {
    id: 'NestedChild',
    key: 'NestedChild',
    customField: 'customField',
    parentId: 'Child1',
  },
  duplicate: {
    id: 'Duplicate',
    key: 'Duplicate',
    customField: 'Duplicate',
  },
  locationWithStock: {
    id: 'LocationWithStock',
    key: 'LocationWithStock',
    customField: 'LocationWithStock',
  },
};
