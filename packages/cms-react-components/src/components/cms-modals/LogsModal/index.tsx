import React, { ReactNode, useState, useMemo, useCallback } from 'react';
import { isNumber } from 'lodash';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Typography,
  Button,
  Icon,
  cx,
} from '@mezzanine-ui/react';
import { ExclamationCircleFilledIcon } from '@mezzanine-ui/icons';
import { useModal } from '../../modal/useModal';
import { ArticleStage } from '../../../typings';
import { LogsData } from './typings';
import classes from './index.module.scss';

export interface LogsModalProps {
  data: {
    [keys in ArticleStage]?: LogsData | null;
  };
  stageWording?: {
    [keys in ArticleStage]?: {
      stageName?: string;
      timeTitle?: string;
      memberTitle?: string;
    };
  };
}

const LogsModal = ({ data, stageWording }: LogsModalProps): ReactNode => {
  const [stageMode, setStageMode] = useState<ArticleStage | null>(null);
  const { closeModal } = useModal();

  const getStageWording = useCallback(
    (
      stage: ArticleStage,
    ): {
      stageName: string;
      timeTitle: string;
      memberTitle: string;
    } => {
      switch (stage) {
        case ArticleStage.DRAFT:
          return {
            stageName: stageWording?.[stage]?.stageName || '草稿',
            timeTitle: stageWording?.[stage]?.timeTitle || '最後編輯時間',
            memberTitle: stageWording?.[stage]?.memberTitle || '編輯人員',
          };

        case ArticleStage.REVIEWING:
          return {
            stageName: stageWording?.[stage]?.stageName || '待審核',
            timeTitle: stageWording?.[stage]?.timeTitle || '送審時間',
            memberTitle: stageWording?.[stage]?.memberTitle || '送審人員',
          };

        case ArticleStage.VERIFIED:
          return {
            stageName: stageWording?.[stage]?.stageName || '可發佈',
            timeTitle: stageWording?.[stage]?.timeTitle || '過審時間',
            memberTitle: stageWording?.[stage]?.memberTitle || '審核人員',
          };

        case ArticleStage.SCHEDULED:
          return {
            stageName: stageWording?.[stage]?.stageName || '已預約',
            timeTitle: stageWording?.[stage]?.timeTitle || '預約發佈時間',
            memberTitle: stageWording?.[stage]?.memberTitle || '預約發佈人員',
          };

        case ArticleStage.RELEASED:
          return {
            stageName: stageWording?.[stage]?.stageName || '已發佈',
            timeTitle: stageWording?.[stage]?.timeTitle || '發佈時間',
            memberTitle: stageWording?.[stage]?.memberTitle || '發佈人員',
          };

        default:
          return {
            stageName: stageWording?.[stage]?.stageName || '',
            timeTitle: stageWording?.[stage]?.timeTitle || '',
            memberTitle: stageWording?.[stage]?.memberTitle || '',
          };
      }
    },
    [stageWording],
  );

  const time = useCallback(
    (currentStage: ArticleStage): string => {
      switch (currentStage) {
        case ArticleStage.DRAFT: {
          if (stageMode) {
            return data[stageMode]?.createdAt || '';
          }

          return data[currentStage]?.updatedAt || '';
        }

        case ArticleStage.REVIEWING: {
          if (stageMode) {
            return data[stageMode]?.submittedAt || '';
          }

          return data[currentStage]?.submittedAt || '';
        }

        case ArticleStage.VERIFIED: {
          if (stageMode) {
            return data[stageMode]?.verifiedAt || '';
          }

          return data[currentStage]?.verifiedAt || '';
        }

        case ArticleStage.SCHEDULED: {
          if (stageMode) {
            return data[stageMode]?.releasedAt || '';
          }

          return data[currentStage]?.releasedAt || '';
        }

        case ArticleStage.RELEASED: {
          if (stageMode) {
            return data[stageMode]?.releasedAt || '';
          }

          return data[currentStage]?.releasedAt || '';
        }

        default:
          return '';
      }
    },
    [data, stageMode],
  );

  const member = useCallback(
    (currentStage: ArticleStage): string => {
      switch (currentStage) {
        case ArticleStage.DRAFT: {
          if (stageMode) {
            return data[stageMode]?.createdBy || '';
          }

          return data[currentStage]?.updatedBy || '';
        }

        case ArticleStage.REVIEWING: {
          if (stageMode) {
            return data[stageMode]?.submittedBy || '';
          }

          return data[currentStage]?.submittedBy || '';
        }

        case ArticleStage.VERIFIED: {
          if (stageMode) {
            return data[stageMode]?.verifiedBy || '';
          }

          return data[currentStage]?.verifiedBy || '';
        }

        case ArticleStage.SCHEDULED: {
          if (stageMode) {
            return data[stageMode]?.releasedBy || '';
          }

          return data[currentStage]?.releasedBy || '';
        }

        case ArticleStage.RELEASED: {
          if (stageMode) {
            return data[stageMode]?.releasedBy || '';
          }

          return data[currentStage]?.releasedBy || '';
        }

        default:
          return '';
      }
    },
    [data, stageMode],
  );

  const stages = useMemo(() => {
    if (stageMode === ArticleStage.SCHEDULED) {
      return [
        ArticleStage.DRAFT,
        ArticleStage.REVIEWING,
        ArticleStage.VERIFIED,
        ArticleStage.SCHEDULED,
      ];
    }

    if (stageMode === ArticleStage.RELEASED) {
      return [
        ArticleStage.DRAFT,
        ArticleStage.REVIEWING,
        ArticleStage.VERIFIED,
        ArticleStage.RELEASED,
      ];
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
    <>
      <ModalHeader showSeverityIcon={false}>版本資訊</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        {stageMode && (
          <Typography variant="h6" color="text-primary">
            {`Ver. ${data[stageMode]?.version}`}
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
                      [classes.notActive]:
                        !time(targetStage) && !member(targetStage),
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
                    <Typography variant="h5" color="text-primary">
                      {getStageWording(targetStage).stageName}
                    </Typography>
                    {!stageMode && isNumber(data[targetStage]?.version) && (
                      <Button
                        type="button"
                        variant="text"
                        color="secondary"
                        size="small"
                        onClick={() => {
                          setStageMode(targetStage);
                        }}
                      >
                        {`Ver. ${data[targetStage].version}`}
                      </Button>
                    )}
                  </div>
                  <div className={classes.list}>
                    <div className={classes.option}>
                      <Typography variant="h6" color="text-secondary">
                        {getStageWording(targetStage).timeTitle}
                      </Typography>
                      <Typography variant="body2" color="text-primary">
                        {time(targetStage) || '-'}
                      </Typography>
                    </div>
                    <div className={classes.option}>
                      <Typography variant="h6" color="text-secondary">
                        {getStageWording(targetStage).memberTitle}
                      </Typography>
                      <Typography variant="body2" color="text-primary">
                        {member(targetStage) || '-'}
                      </Typography>
                    </div>
                  </div>
                  {!!data[targetStage]?.reason &&
                    targetStage === ArticleStage.DRAFT && (
                      <div className={classes.reasonWrapper}>
                        <Icon
                          icon={ExclamationCircleFilledIcon}
                          size={24}
                          color="warning"
                        />
                        <Typography variant="input1" color="text-primary">
                          {data[targetStage].reason}
                        </Typography>
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </MznModalBody>
      <ModalActions
        cancelText="返回"
        confirmText="關閉"
        cancelButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'outlined',
          danger: false,
          style: {
            display: stageMode ? 'flex' : 'none',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: false,
        }}
        onCancel={() => {
          setStageMode(null);
        }}
        onConfirm={closeModal}
      />
    </>
  );
};

export { LogsModal };
