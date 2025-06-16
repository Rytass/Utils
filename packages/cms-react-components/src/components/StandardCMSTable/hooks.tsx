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
import classes from './index.module.scss';

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
        const actionsFilterByPermissions = currentTableActions?.filter(
          (action) => {
            switch (action) {
              case ArticleTableActions.Update:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.UpdateArticleInDraft,
                });

              case ArticleTableActions.Submit:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.SubmitPutBackArticle,
                });

              case ArticleTableActions.Release:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.ReleaseArticleInDraft,
                });

              case ArticleTableActions.Delete:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.DeleteArticleInDraft,
                });

              default:
                return false;
            }
          },
        );

        if (actionsFilterByPermissions?.length === 0) return [];

        return [
          {
            title: '',
            align: 'end',
            render: (source) => (
              <div className={classes.tableActions}>
                {actionsFilterByPermissions?.map((action) => {
                  switch (action) {
                    case ArticleTableActions.Update: {
                      return (
                        <Button type="button" variant="text">
                          編輯
                        </Button>
                      );
                    }

                    case ArticleTableActions.Submit: {
                      return (
                        <Button type="button" variant="text">
                          送審
                        </Button>
                      );
                    }

                    case ArticleTableActions.Release: {
                      return (
                        <Button type="button" variant="text">
                          發佈
                        </Button>
                      );
                    }

                    case ArticleTableActions.Delete: {
                      return (
                        <Button type="button" variant="text" danger>
                          刪除此版本
                        </Button>
                      );
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
