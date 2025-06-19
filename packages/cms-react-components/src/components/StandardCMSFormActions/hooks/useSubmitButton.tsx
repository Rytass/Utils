import React from 'react';
import { FieldValues } from 'react-hook-form';
import { havePermission } from '../../../utils/havePermission';
import { StandardCMSFormActionsEventsProps } from '../typings';
import { ArticleStage, ArticlesPermissions } from '../../../typings';
import { VerifyReleaseModal } from '../../cms-modals/VerifyReleaseModal';
import { useDialog } from '../../dialog/useDialog';
import { useModal } from '../../modal/useModal';

export function useSubmitButton<T extends FieldValues>({
  values,
  isDirty,
  createMode,
  currentStage,
  userPermissions,
  actionsEvents,
}: {
  values: T;
  isDirty: boolean;
  createMode?: boolean;
  currentStage: ArticleStage;
  userPermissions: ArticlesPermissions[];
  actionsEvents: StandardCMSFormActionsEventsProps<T>;
}): {
  text: string;
  disabled?: boolean;
  onSubmit?: () => Promise<void>;
} {
  const { openDialog } = useDialog();
  const { openModal } = useModal();

  if (createMode) {
    if (
      havePermission({
        userPermissions,
        targetPermission: ArticlesPermissions.CreateArticle,
      })
    ) {
      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ApproveRejectArticle,
        })
      ) {
        return {
          text: '發佈',
          onSubmit: async () => {
            openModal({
              severity: 'success',
              children: (
                <VerifyReleaseModal
                  title="審核通過"
                  withApprove
                  showSeverityIcon
                  onRelease={async (releasedAt) => {
                    await actionsEvents.onCreateAndRelease?.(
                      values,
                      releasedAt,
                    );
                  }}
                  onApprove={async () => {
                    await actionsEvents.onCreateAndApprove?.(values);
                  }}
                />
              ),
            });
          },
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.SubmitPutBackArticle,
        })
      ) {
        return {
          text: '送審',
          onSubmit: async () => {
            const isConfirm = await openDialog({
              severity: 'info',
              size: 'small',
              title: '提交審核此文章',
              children: '請確認是否提交審核此文章。',
              cancelText: '取消',
              cancelButtonProps: {
                danger: false,
              },
              confirmText: '提交審核',
              confirmButtonProps: {
                danger: false,
              },
            });

            if (isConfirm) {
              await actionsEvents.onCreateAndSubmit?.(values);
            }
          },
        };
      }

      return {
        text: '',
        onSubmit: undefined,
      };
    }

    return {
      text: '',
      onSubmit: undefined,
    };
  }

  switch (currentStage) {
    case ArticleStage.DRAFT: {
      if (
        isDirty &&
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInDraft,
        })
      ) {
        if (
          havePermission({
            userPermissions,
            targetPermission: ArticlesPermissions.ApproveRejectArticle,
          })
        ) {
          return {
            text: '發佈',
            onSubmit: async () => {
              openModal({
                severity: 'success',
                children: (
                  <VerifyReleaseModal
                    title="審核通過"
                    withApprove
                    showSeverityIcon
                    onRelease={async (releasedAt) => {
                      await actionsEvents.onUpdateAndRelease?.(
                        values,
                        releasedAt,
                      );
                    }}
                    onApprove={async () => {
                      await actionsEvents.onUpdateAndApprove?.(values);
                    }}
                  />
                ),
              });
            },
          };
        }

        if (
          havePermission({
            userPermissions,
            targetPermission: ArticlesPermissions.SubmitPutBackArticle,
          })
        ) {
          return {
            text: '送審',
            onSubmit: async () => {
              const isConfirm = await openDialog({
                severity: 'info',
                size: 'small',
                title: '提交審核此文章',
                children: '請確認是否提交審核此文章。',
                cancelText: '取消',
                cancelButtonProps: {
                  danger: false,
                },
                confirmText: '提交審核',
                confirmButtonProps: {
                  danger: false,
                },
              });

              if (isConfirm) {
                await actionsEvents.onUpdateAndSubmit?.(values);
              }
            },
          };
        }

        return {
          text: '',
          onSubmit: undefined,
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ApproveRejectArticle,
        })
      ) {
        return {
          text: '發佈',
          onSubmit: async () => {
            openModal({
              severity: 'success',
              children: (
                <VerifyReleaseModal
                  title="審核通過"
                  withApprove
                  showSeverityIcon
                  onRelease={async (releasedAt) => {
                    await actionsEvents.onRelease?.(values, releasedAt);
                  }}
                  onApprove={async () => {
                    await actionsEvents.onApprove?.(values);
                  }}
                />
              ),
            });
          },
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.SubmitPutBackArticle,
        })
      ) {
        return {
          text: '送審',
          onSubmit: async () => {
            const isConfirm = await openDialog({
              severity: 'info',
              size: 'small',
              title: '提交審核此文章',
              children: '請確認是否提交審核此文章。',
              cancelText: '取消',
              cancelButtonProps: {
                danger: false,
              },
              confirmText: '提交審核',
              confirmButtonProps: {
                danger: false,
              },
            });

            if (isConfirm) {
              await actionsEvents.onSubmit?.(values);
            }
          },
        };
      }

      return {
        text: '',
        onSubmit: undefined,
      };
    }

    case ArticleStage.REVIEWING: {
      if (
        isDirty &&
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInReviewing,
        })
      ) {
        if (
          havePermission({
            userPermissions,
            targetPermission: ArticlesPermissions.ApproveRejectArticle,
          })
        ) {
          return {
            text: '審核通過',
            onSubmit: async () => {
              openModal({
                severity: 'success',
                children: (
                  <VerifyReleaseModal
                    title="審核通過"
                    withApprove
                    showSeverityIcon
                    onRelease={async (releasedAt) => {
                      await actionsEvents.onUpdateAndRelease?.(
                        values,
                        releasedAt,
                      );
                    }}
                    onApprove={async () => {
                      await actionsEvents.onUpdateAndApprove?.(values);
                    }}
                  />
                ),
              });
            },
          };
        }

        if (
          havePermission({
            userPermissions,
            targetPermission: ArticlesPermissions.SubmitPutBackArticle,
          })
        ) {
          return {
            text: '送審',
            onSubmit: async () => {
              const isConfirm = await openDialog({
                severity: 'info',
                size: 'small',
                title: '提交審核此文章',
                children: '請確認是否提交審核此文章。',
                cancelText: '取消',
                cancelButtonProps: {
                  danger: false,
                },
                confirmText: '提交審核',
                confirmButtonProps: {
                  danger: false,
                },
              });

              if (isConfirm) {
                await actionsEvents.onUpdateAndSubmit?.(values);
              }
            },
          };
        }

        return {
          text: '',
          onSubmit: undefined,
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ApproveRejectArticle,
        })
      ) {
        return {
          text: '審核通過',
          onSubmit: async () => {
            openModal({
              severity: 'success',
              children: (
                <VerifyReleaseModal
                  title="審核通過"
                  withApprove
                  showSeverityIcon
                  onRelease={async (releasedAt) => {
                    await actionsEvents.onRelease?.(values, releasedAt);
                  }}
                  onApprove={async () => {
                    await actionsEvents.onApprove?.(values);
                  }}
                />
              ),
            });
          },
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.SubmitPutBackArticle,
        })
      ) {
        return {
          text: '送審',
          disabled: true,
          onSubmit: async () => {},
        };
      }

      return {
        text: '',
        onSubmit: undefined,
      };
    }

    case ArticleStage.VERIFIED: {
      if (
        isDirty &&
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.UpdateArticleInVerified,
        })
      ) {
        if (
          havePermission({
            userPermissions,
            targetPermission: ArticlesPermissions.ReleaseArticleInVerified,
          })
        ) {
          return {
            text: '發佈',
            onSubmit: async () => {
              openModal({
                severity: 'success',
                children: (
                  <VerifyReleaseModal
                    title="發佈設定"
                    withApprove={false}
                    showSeverityIcon={false}
                    onRelease={async (releasedAt) => {
                      await actionsEvents.onUpdateAndRelease?.(
                        values,
                        releasedAt,
                      );
                    }}
                  />
                ),
              });
            },
          };
        }

        return {
          text: '',
          onSubmit: undefined,
        };
      }

      if (
        havePermission({
          userPermissions,
          targetPermission: ArticlesPermissions.ReleaseArticleInVerified,
        })
      ) {
        return {
          text: '發佈設定',
          onSubmit: async () => {
            openModal({
              severity: 'success',
              children: (
                <VerifyReleaseModal
                  title="發佈設定"
                  withApprove={false}
                  showSeverityIcon={false}
                  onRelease={async (releasedAt) => {
                    await actionsEvents.onRelease?.(values, releasedAt);
                  }}
                />
              ),
            });
          },
        };
      }

      return {
        text: '',
        onSubmit: undefined,
      };
    }

    default:
      return {
        text: '',
        onSubmit: undefined,
      };
  }
}
