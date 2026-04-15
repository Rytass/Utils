import React, { ReactNode, useState, useMemo, useEffect, useCallback } from 'react';
import { isNumber } from 'lodash';
import { Modal, Typography, Button, Icon, cx } from '@mezzanine-ui/react';
import { ErrorFilledIcon } from '@mezzanine-ui/icons';
import Loading from '../../Loading';
import { ArticleStage } from '../../../typings';
import { LogsStageData } from './typings';
import classes from './index.module.scss';

export interface LogsModalProps {
  onGetData: () => Promise<LogsStageData>;
  stageWording?: {
    [keys in ArticleStage]?: {
      stageName?: string;
      timeTitle?: string;
      memberTitle?: string;
    };
  };
}

type LogsModalWithOpenProps = LogsModalProps & {
  open: boolean;
  closeModal: VoidFunction;
};

const LogsModal = ({ open, closeModal, onGetData, stageWording }: LogsModalWithOpenProps): ReactNode => {
  const [data, setData] = useState<LogsStageData | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [stageMode, setStageMode] = useState<ArticleStage | null>(null);

  useEffect(() => {
    (async (): Promise<void> => {
      setLoading(true);

      const data = await onGetData();

      setLoading(false);

      setData(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStageWording = useCallback(
    (
      currentStage: ArticleStage,
    ): {
      stageName: string;
      timeTitle: string;
      memberTitle: string;
    } => {
      switch (currentStage) {
        case ArticleStage.DRAFT:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '草稿',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '最後編輯時間',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '編輯人員',
          };

        case ArticleStage.REVIEWING:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '待審核',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '送審時間',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '送審人員',
          };

        case ArticleStage.VERIFIED:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '可發佈',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '過審時間',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '審核人員',
          };

        case ArticleStage.SCHEDULED:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '已預約',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '預約發佈時間',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '預約發佈人員',
          };

        case ArticleStage.RELEASED:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '已發佈',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '發佈時間',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '發佈人員',
          };

        default:
          return {
            stageName: stageWording?.[currentStage]?.stageName || '',
            timeTitle: stageWording?.[currentStage]?.timeTitle || '',
            memberTitle: stageWording?.[currentStage]?.memberTitle || '',
          };
      }
    },
    [stageWording],
  );

  const getStageData = useCallback(
    (currentStage: ArticleStage) => {
      switch (currentStage) {
        case ArticleStage.DRAFT: {
          if (stageMode) {
            return {
              time: data?.[stageMode]?.createdAt || '',
              member: data?.[stageMode]?.createdBy || '',
              reason: data?.[stageMode]?.reason || '',
            };
          }

          return {
            time: data?.[currentStage]?.updatedAt || '',
            member: data?.[currentStage]?.updatedBy || '',
            reason: data?.[currentStage]?.reason || '',
          };
        }

        case ArticleStage.REVIEWING: {
          if (stageMode) {
            if ([ArticleStage.DRAFT].includes(stageMode)) {
              return {
                time: '',
                member: '',
                reason: '',
              };
            }

            return {
              time: data?.[stageMode]?.submittedAt || '',
              member: data?.[stageMode]?.submittedBy || '',
              reason: data?.[stageMode]?.reason || '',
            };
          }

          return {
            time: data?.[currentStage]?.submittedAt || '',
            member: data?.[currentStage]?.submittedBy || '',
            reason: data?.[currentStage]?.reason || '',
          };
        }

        case ArticleStage.VERIFIED: {
          if (stageMode) {
            if ([ArticleStage.DRAFT, ArticleStage.REVIEWING].includes(stageMode)) {
              return {
                time: '',
                member: '',
                reason: '',
              };
            }

            return {
              time: data?.[stageMode]?.verifiedAt || '',
              member: data?.[stageMode]?.verifiedBy || '',
              reason: data?.[stageMode]?.reason || '',
            };
          }

          return {
            time: data?.[currentStage]?.verifiedAt || '',
            member: data?.[currentStage]?.verifiedBy || '',
            reason: data?.[currentStage]?.reason || '',
          };
        }

        case ArticleStage.SCHEDULED: {
          if (stageMode) {
            if (
              [ArticleStage.DRAFT, ArticleStage.REVIEWING, ArticleStage.VERIFIED, ArticleStage.RELEASED].includes(
                stageMode,
              )
            ) {
              return {
                time: '',
                member: '',
                reason: '',
              };
            }

            return {
              time: data?.[stageMode]?.releasedAt || '',
              member: data?.[stageMode]?.releasedBy || '',
              reason: data?.[stageMode]?.reason || '',
            };
          }

          return {
            time: data?.[currentStage]?.releasedAt || '',
            member: data?.[currentStage]?.releasedBy || '',
            reason: data?.[currentStage]?.reason || '',
          };
        }
        case ArticleStage.RELEASED: {
          if (stageMode) {
            if (
              [ArticleStage.DRAFT, ArticleStage.REVIEWING, ArticleStage.VERIFIED, ArticleStage.SCHEDULED].includes(
                stageMode,
              )
            ) {
              return {
                time: '',
                member: '',
                reason: '',
              };
            }

            return {
              time: data?.[stageMode]?.releasedAt || '',
              member: data?.[stageMode]?.releasedBy || '',
              reason: data?.[stageMode]?.reason || '',
            };
          }

          return {
            time: data?.[currentStage]?.releasedAt || '',
            member: data?.[currentStage]?.releasedBy || '',
            reason: data?.[currentStage]?.reason || '',
          };
        }

        default:
          return {
            time: '',
            member: '',
            reason: '',
          };
      }
    },
    [data, stageMode],
  );

  const stages = useMemo(() => {
    if (stageMode === ArticleStage.SCHEDULED) {
      return [ArticleStage.DRAFT, ArticleStage.REVIEWING, ArticleStage.VERIFIED, ArticleStage.SCHEDULED];
    }

    if (stageMode === ArticleStage.RELEASED) {
      return [ArticleStage.DRAFT, ArticleStage.REVIEWING, ArticleStage.VERIFIED, ArticleStage.RELEASED];
    }

    return [
      ArticleStage.DRAFT,
      ArticleStage.REVIEWING,
      ArticleStage.VERIFIED,
      ArticleStage.SCHEDULED,
      ArticleStage.RELEASED,
    ];
  }, [stageMode]);

  return (
    <Modal
      open={open}
      modalType="standard"
      title="版本資訊"
      titleAlign="left"
      showStatusTypeIcon={false}
      cancelText="返回"
      confirmText="關閉"
      onCancel={() => {
        setStageMode(null);
      }}
      onConfirm={closeModal}
      cancelButtonProps={{
        type: 'button',
        variant: 'base-secondary',
      }}
      confirmButtonProps={{
        type: 'button',
        variant: 'base-primary',
      }}
      showModalHeader
      showModalFooter
    >
      {loading ? (
        <Loading />
      ) : (
        <div className={classes.modalBody}>
          {stageMode && (
            <Typography variant="label-primary-highlight" color="text-neutral">
              {`Ver. ${data?.[stageMode]?.version}`}
            </Typography>
          )}
          <div className={classes.wrapper}>
            {stages.map((targetStage, index) => {
              return (
                <div key={targetStage} className={classes.block}>
                  <div className={classes.timeLineWrapper}>
                    <div
                      className={cx(classes.topLine, {
                        [classes.isHidden]: index === 0,
                      })}
                    />
                    <div
                      className={cx(classes.dot, {
                        [classes.notActive]: !getStageData(targetStage).time && !getStageData(targetStage).member,
                      })}
                    />
                    <div
                      className={cx(classes.bottomLine, {
                        [classes.isHidden]: index === stages.length - 1,
                      })}
                    />
                  </div>
                  <div className={classes.contentWrapper}>
                    <div className={classes.stageWrapper}>
                      <Typography variant="label-primary" color="text-neutral">
                        {getStageWording(targetStage).stageName}
                      </Typography>
                      {!stageMode && isNumber(data?.[targetStage]?.version) && (
                        <Button
                          type="button"
                          variant="base-ghost"
                          color="secondary"
                          size="minor"
                          onClick={() => {
                            setStageMode(targetStage);
                          }}
                        >
                          {`Ver. ${data?.[targetStage].version}`}
                        </Button>
                      )}
                    </div>
                    <div className={classes.list}>
                      <div className={classes.option}>
                        <Typography variant="label-primary-highlight" color="text-neutral-light">
                          {getStageWording(targetStage).timeTitle}
                        </Typography>
                        <Typography variant="body" color="text-neutral">
                          {getStageData(targetStage).time || '-'}
                        </Typography>
                      </div>
                      <div className={classes.option}>
                        <Typography variant="label-primary-highlight" color="text-neutral-light">
                          {getStageWording(targetStage).memberTitle}
                        </Typography>
                        <Typography variant="body" color="text-neutral">
                          {getStageData(targetStage).member || '-'}
                        </Typography>
                      </div>
                    </div>
                    {!!getStageData(targetStage).reason && targetStage === ArticleStage.DRAFT && (
                      <div className={classes.reasonWrapper}>
                        <Icon icon={ErrorFilledIcon} size={24} color="warning" />
                        <Typography variant="input" color="text-neutral">
                          {getStageData(targetStage).reason}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
};

export { LogsModal };
