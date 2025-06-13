import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CmsService {
  constructor(
    @Inject('CMS_OPTIONS')
    private readonly options: { enableLogging?: boolean },
  ) {
    if (this.options.enableLogging) {
      console.log('[CMS] Logging is enabled.');
    }
  }

  hello(): string {
    return 'Hello from CMS Service!';
  }
}
