import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LocationEntity, LocationRepo } from '../models/location.entity';

@Injectable()
export class LocationService {
  constructor(
    @Inject(LocationRepo)
    private readonly locationRepo: Repository<LocationEntity>,
  ) {}
}
