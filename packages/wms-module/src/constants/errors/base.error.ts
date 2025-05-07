import { BadRequestException } from '@nestjs/common';

export class LocationNotFoundError extends BadRequestException {
  constructor() {
    super('Location not found');
  }

  code = 100;
}

export class LocationCannotArchiveError extends BadRequestException {
  constructor() {
    super(
      'Location cannot archive, please check if there are stocks in this location',
    );
  }

  code = 101;
}

export class LocationAlreadyExistedError extends BadRequestException {
  constructor() {
    super('Location already existed');
  }

  code = 102;
}
