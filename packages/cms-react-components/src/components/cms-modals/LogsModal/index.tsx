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
  data: LogsData;
  versionsData?: {
    [keys in number]?: LogsData;
  };
  stageWording?: {
    [keys in ArticleStage]?: {
      stageName?: string;
      timeTitle?: string;
      memberTitle?: string;
    };
  };
}

function normalizeData(currentData: LogsData): {
  [key in ArticleStage]?: {
    time: string;
    member: string;
    version?: number;
    reason?: string;
  };
} {
  return {
    [ArticleStage.DRAFT]: {
      ...currentData[ArticleStage.DRAFT],
      time: currentData[ArticleStage.DRAFT].updatedAt,
      member: currentData[ArticleStage.DRAFT].updatedBy,
    },
    [ArticleStage.REVIEWING]: {
      ...currentData[ArticleStage.REVIEWING],
      time: currentData[ArticleStage.REVIEWING].submittedAt,
      member: currentData[ArticleStage.REVIEWING].submittedBy,
    },
    [ArticleStage.VERIFIED]: {
      ...currentData[ArticleStage.VERIFIED],
      time: currentData[ArticleStage.VERIFIED].verifiedAt,
      member: currentData[ArticleStage.VERIFIED].verifiedBy,
    },
    [ArticleStage.SCHEDULED]: {
      ...currentData[ArticleStage.SCHEDULED],
      time: currentData[ArticleStage.SCHEDULED].scheduledAt,
      member: currentData[ArticleStage.SCHEDULED].scheduledBy,
    },
    [ArticleStage.RELEASED]: {
      ...currentData[ArticleStage.RELEASED],
      time: currentData[ArticleStage.RELEASED].releasedAt,
      member: currentData[ArticleStage.RELEASED].releasedBy,
    },
  };
}

const LogsModal = ({
  data,
  versionsData,
  stageWording,
}: LogsModalProps): ReactNode => {
  const [versionMode, setVersionMode] = useState<number | null>(null);
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

  const targetData = useMemo(
    () => (isNumber(versionMode) ? versionsData?.[versionMode] : data),
    [data, versionMode, versionsData],
  );

  const targetDataNormalized = useMemo(
    () => (targetData ? normalizeData(targetData) : null),
    [targetData],
  );

  return (
    <>
      <ModalHeader showSeverityIcon={false}>版本資訊</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        {isNumber(versionMode) && (
          <Typography variant="h6" color="text-primary">
            {`Ver. ${versionMode}`}
          </Typography>
        )}
        {targetDataNormalized && (
          <div className={classes.wrapper}>
            {[
              ArticleStage.DRAFT,
              ArticleStage.REVIEWING,
              ArticleStage.VERIFIED,
              ArticleStage.SCHEDULED,
              ArticleStage.RELEASED,
            ].map((targetStage) => {
              return (
                <div key={targetStage} className={classes.block}>
                  <div className={classes.timeLineWrapper}>
                    <div
                      className={cx(classes.topLine, {
                        [classes.isHidden]: targetStage === ArticleStage.DRAFT,
                      })}
                    />
                    <div
                      className={cx(classes.dot, {
                        [classes.notActive]:
                          !targetDataNormalized[targetStage]?.time &&
                          !targetDataNormalized[targetStage]?.member,
                      })}
                    />
                    <div
                      className={cx(classes.bottomLine, {
                        [classes.isHidden]:
                          targetStage === ArticleStage.RELEASED,
                      })}
                    />
                  </div>
                  <div className={classes.contentWrapper}>
                    <div className={classes.stageWrapper}>
                      <Typography variant="h5" color="text-primary">
                        {getStageWording(targetStage).stageName}
                      </Typography>
                      {!isNumber(versionMode) &&
                        isNumber(
                          targetDataNormalized[targetStage]?.version,
                        ) && (
                          <Button
                            type="button"
                            variant="text"
                            color="secondary"
                            size="small"
                            onClick={() => {
                              setVersionMode(
                                targetDataNormalized[targetStage]?.version!,
                              );
                            }}
                          >
                            {`Ver. ${targetDataNormalized[targetStage].version}`}
                          </Button>
                        )}
                    </div>
                    <div className={classes.list}>
                      <div className={classes.option}>
                        <Typography variant="h6" color="text-secondary">
                          {getStageWording(targetStage).timeTitle}
                        </Typography>
                        <Typography variant="body2" color="text-primary">
                          {targetDataNormalized[targetStage]?.time || '-'}
                        </Typography>
                      </div>
                      <div className={classes.option}>
                        <Typography variant="h6" color="text-secondary">
                          {getStageWording(targetStage).memberTitle}
                        </Typography>
                        <Typography variant="body2" color="text-primary">
                          {targetDataNormalized[targetStage]?.member || '-'}
                        </Typography>
                      </div>
                    </div>
                    {!!targetDataNormalized[targetStage]?.reason && (
                      <div className={classes.reasonWrapper}>
                        <Icon
                          icon={ExclamationCircleFilledIcon}
                          size={24}
                          color="warning"
                        />
                        <Typography variant="input1" color="text-primary">
                          {targetDataNormalized[targetStage].reason}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            display: isNumber(versionMode) ? 'flex' : 'none',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: false,
        }}
        onCancel={() => {
          setVersionMode(null);
        }}
        onConfirm={closeModal}
      />
    </>
  );
};

export { LogsModal };
