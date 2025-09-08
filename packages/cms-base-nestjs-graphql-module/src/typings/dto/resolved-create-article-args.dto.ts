import { QuadratsElement } from '@quadrats/core';
import { CustomFieldValue } from '../custom-field-value.type';

type BaseResolvedCreateArticleArgsDto = {
  categoryIds: string[];
  tags: string[];
  submitted?: boolean;
  signatureLevel?: string | null;
  releasedAt?: Date | null;
  // Allow additional custom fields
  [key: string]: CustomFieldValue;
};

export type SingleLanguageResolvedCreateArticleArgsDto = BaseResolvedCreateArticleArgsDto & {
  title: string;
  content: QuadratsElement[];
  description?: string;
};

export type MultiLanguageResolvedCreateArticleArgsDto = BaseResolvedCreateArticleArgsDto & {
  multiLanguageContents: Record<
    string,
    {
      title: string;
      description?: string;
      content: QuadratsElement[];
    }
  >;
};

export type ResolvedCreateArticleArgsDto =
  | SingleLanguageResolvedCreateArticleArgsDto
  | MultiLanguageResolvedCreateArticleArgsDto;
