import { BadRequestException } from '@nestjs/common';

export class MultipleLanguageModeIsDisabledError extends BadRequestException {
  constructor() {
    super('Multiple language mode is disabled');
  }

  code = 100;
}
