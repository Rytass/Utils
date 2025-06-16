import React, { useMemo } from 'react';
import { Button } from '@mezzanine-ui/react';
import { TableColumn, TableDataSourceWithID } from '@mezzanine-ui/core/table';
import {
  ArticleStage,
  ArticleTableActions,
  ArticlesPermissions,
  ArticleTableActionsType,
} from '../../typings';
import { defaultTableActions } from '../../constants';
import { havePermission } from '../../utils/havePermission';

export function useMappingTableActions<T extends TableDataSourceWithID>({
  currentStage,
  userPermissions,
  actions,
}: {
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actions?: ArticleTableActionsType;
}): TableColumn<T>[] {
  const tableActions = useMemo((): TableColumn<T>[] => {
    const currentTableActions =
      actions?.[currentStage] ?? defaultTableActions[currentStage];

    if (currentTableActions?.length === 0) return [];

    switch (currentStage) {
      case ArticleStage.DRAFT: {
        return [
          {
            title: '',
            render: (source) => (
              <div>
                {currentTableActions?.map((action) => {
                  switch (action) {
                    case ArticleTableActions.Update: {
                      if (
                        havePermission({
                          userPermissions,
                          targetPermission:
                            ArticlesPermissions.UpdateArticleInDraft,
                        })
                      ) {
                        return (
                          <Button type="button" variant="text">
                            編輯
                          </Button>
                        );
                      }

                      return null;
                    }

                    case ArticleTableActions.Submit: {
                      if (
                        havePermission({
                          userPermissions,
                          targetPermission:
                            ArticlesPermissions.SubmitPutBackArticle,
                        })
                      ) {
                        return (
                          <Button type="button" variant="text">
                            送審
                          </Button>
                        );
                      }

                      return null;
                    }

                    case ArticleTableActions.Release: {
                      if (
                        havePermission({
                          userPermissions,
                          targetPermission:
                            ArticlesPermissions.ReleaseArticleInDraft,
                        })
                      ) {
                        return (
                          <Button type="button" variant="text">
                            發佈
                          </Button>
                        );
                      }

                      return null;
                    }

                    case ArticleTableActions.Delete: {
                      if (
                        havePermission({
                          userPermissions,
                          targetPermission:
                            ArticlesPermissions.DeleteArticleInDraft,
                        })
                      ) {
                        return (
                          <Button type="button" variant="text" danger>
                            刪除此版本
                          </Button>
                        );
                      }

                      return null;
                    }

                    default:
                      return null;
                  }
                })}
              </div>
            ),
          },
        ];
      }

      default:
        return [];
    }
  }, [actions, currentStage, userPermissions]);

  return tableActions;
}
