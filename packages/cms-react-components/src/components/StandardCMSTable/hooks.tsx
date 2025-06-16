import React, { useCallback, useMemo } from 'react';
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
import { useDialog } from '../dialog/useDialog';
import { useModal } from '../modal/useModal';
import { StandardCMSTableEventsProps } from './typings';
import classes from './index.module.scss';

export function useMappingTableActions<T extends TableDataSourceWithID>({
  currentStage,
  userPermissions,
  actionsEvents,
  actions,
}: {
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSTableEventsProps<T>;
  actions?: ArticleTableActionsType;
}): TableColumn<T>[] {
  const { openDialog } = useDialog();
  const { openModal } = useModal();

  const onUpdate = useCallback(
    (source: T) => async () => {
      await actionsEvents.onUpdate?.(source);
    },
    [actionsEvents],
  );

  const onDelete = useCallback(
    (source: T) => async () => {
      const isConfirm = await openDialog({
        severity: 'error',
        style: { width: 384 },
        title: '確認刪除文章？',
        children: '此動作無法復原。',
        cancelText: '取消',
        cancelButtonProps: {
          danger: false,
        },
        confirmText: '刪除文章',
      });

      if (isConfirm) {
        await actionsEvents.onDelete?.(source);
      }
    },
    [actionsEvents, openDialog],
  );

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
                        <Button
                          type="button"
                          variant="text"
                          onClick={onUpdate(source)}
                        >
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
                        <Button
                          type="button"
                          variant="text"
                          danger
                          onClick={onDelete(source)}
                        >
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

      case ArticleStage.REVIEWING: {
        const actionsFilterByPermissions = currentTableActions?.filter(
          (action) => {
            switch (action) {
              case ArticleTableActions.Update:
                return havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.UpdateArticleInReviewing,
                });

              case ArticleTableActions.Review:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.ApproveRejectArticle,
                });

              case ArticleTableActions.Delete:
                return havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.DeleteArticleInReviewing,
                });

              case ArticleTableActions.PutBack:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.SubmitPutBackArticle,
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

                    case ArticleTableActions.Review: {
                      return (
                        <Button type="button" variant="text">
                          審核
                        </Button>
                      );
                    }

                    case ArticleTableActions.Delete: {
                      return (
                        <Button type="button" variant="text" danger>
                          刪除
                        </Button>
                      );
                    }

                    case ArticleTableActions.PutBack: {
                      return (
                        <Button type="button" variant="text" danger>
                          撤回審核
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

      case ArticleStage.VERIFIED: {
        const actionsFilterByPermissions = currentTableActions?.filter(
          (action) => {
            switch (action) {
              case ArticleTableActions.View:
                return !havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.UpdateArticleInVerified,
                });

              case ArticleTableActions.Update:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.UpdateArticleInVerified,
                });

              case ArticleTableActions.Release:
                return havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.ReleaseArticleInVerified,
                });

              case ArticleTableActions.Delete:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.DeleteArticleInVerified,
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
                    case ArticleTableActions.View: {
                      return (
                        <Button type="button" variant="text">
                          檢視
                        </Button>
                      );
                    }

                    case ArticleTableActions.Update: {
                      return (
                        <Button type="button" variant="text">
                          編輯
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
                          刪除
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

      case ArticleStage.SCHEDULED: {
        const actionsFilterByPermissions = currentTableActions?.filter(
          (action) => {
            switch (action) {
              case ArticleTableActions.View:
                return !havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.UpdateArticleInScheduled,
                });

              case ArticleTableActions.Update:
                return havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.UpdateArticleInScheduled,
                });

              case ArticleTableActions.Withdraw:
                return havePermission({
                  userPermissions,
                  targetPermission:
                    ArticlesPermissions.WithdrawArticleInScheduled,
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
                    case ArticleTableActions.View: {
                      return (
                        <Button type="button" variant="text">
                          檢視
                        </Button>
                      );
                    }

                    case ArticleTableActions.Update: {
                      return (
                        <Button type="button" variant="text">
                          編輯
                        </Button>
                      );
                    }

                    case ArticleTableActions.Withdraw: {
                      return (
                        <Button type="button" variant="text" danger>
                          取消發佈
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

      case ArticleStage.RELEASED: {
        const actionsFilterByPermissions = currentTableActions?.filter(
          (action) => {
            switch (action) {
              case ArticleTableActions.Update:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.UpdateArticleInReleased,
                });

              case ArticleTableActions.Delete:
                return havePermission({
                  userPermissions,
                  targetPermission: ArticlesPermissions.DeleteArticleInReleased,
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

                    case ArticleTableActions.Delete: {
                      return (
                        <Button type="button" variant="text" danger>
                          移除
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
  }, [actions, currentStage, onUpdate, onDelete, userPermissions]);

  return tableActions;
}
