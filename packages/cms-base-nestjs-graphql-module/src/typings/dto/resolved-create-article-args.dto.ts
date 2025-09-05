import { QuadratsElement } from '@quadrats/core';

export interface ResolvedCreateArticleArgsDto {
  categoryIds: string[];
  tags: string[];
  submitted?: boolean;
  signatureLevel?: string | null;
  releasedAt?: Date | null;
  // Single language fields (optional)
  title?: string;
  content?: QuadratsElement[];
  description?: string;
  // Multi language fields (optional)
  multiLanguageContents?: Record<
    string,
    {
      title: string;
      description?: string;
      content: QuadratsElement[];
    }
  >;
  // Allow additional custom fields
  [key: string]: any;
}
