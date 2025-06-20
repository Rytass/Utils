import React, { ReactNode, useState } from 'react';
import {
  ModalHeader,
  ModalBody as MznModalBody,
  ModalActions,
  Typography,
  Button,
  cx,
} from '@mezzanine-ui/react';
import { useModal } from '../../modal/useModal';
import { ArticleStage } from '../../../typings';
import classes from './index.module.scss';

const data: {
  [keys in ArticleStage]?: {
    time: string;
    member: string;
    version: number;
  };
} = {
  [ArticleStage.DRAFT]: {
    time: '2025-06-01．13:30',
    member: 'staff@email.com',
    version: 1,
  },
  [ArticleStage.REVIEWING]: {
    time: '2025-06-02．13:30',
    member: 'manager@email.com',
    version: 2,
  },
  [ArticleStage.VERIFIED]: {
    time: '2025-06-03．13:30',
    member: 'staff@email.com',
    version: 3,
  },
  [ArticleStage.SCHEDULED]: {
    time: '',
    member: '',
    version: 0,
  },
  [ArticleStage.RELEASED]: {
    time: '2025-06-05．13:30',
    member: 'staff@email.com',
    version: 5,
  },
};

export function getStageNaming(stage: ArticleStage): {
  stageName: string;
  timeTitle: string;
  memberTitle: string;
} {
  switch (stage) {
    case ArticleStage.DRAFT:
      return {
        stageName: '草稿',
        timeTitle: '最後編輯時間',
        memberTitle: '編輯人員',
      };

    case ArticleStage.REVIEWING:
      return {
        stageName: '待審核',
        timeTitle: '送審時間',
        memberTitle: '送審人員',
      };

    case ArticleStage.VERIFIED:
      return {
        stageName: '可發佈',
        timeTitle: '過審時間',
        memberTitle: '審核人員',
      };

    case ArticleStage.SCHEDULED:
      return {
        stageName: '已預約',
        timeTitle: '預約發佈時間',
        memberTitle: '預約發佈人員',
      };

    case ArticleStage.RELEASED:
      return {
        stageName: '已發佈',
        timeTitle: '發佈時間',
        memberTitle: '發佈人員',
      };

    default:
      return {
        stageName: '',
        timeTitle: '',
        memberTitle: '',
      };
  }
}

export interface LogsModalProps {}

const LogsModal = (): ReactNode => {
  const [versionMode, setVersionMode] = useState<boolean>(false);
  const { closeModal } = useModal();

  return (
    <>
      <ModalHeader showSeverityIcon={false}>版本資訊</ModalHeader>
      <MznModalBody className={classes.modalBody}>
        {versionMode && (
          <Typography variant="h6" color="text-primary">
            Ver. 1
          </Typography>
        )}
        <div className={classes.wrapper}>
          {Object.keys(data).map((stage) => {
            const targetStage = stage as ArticleStage;

            return (
              <div key={stage} className={classes.block}>
                <div className={classes.timeLineWrapper}>
                  <div
                    className={cx(classes.topLine, {
                      [classes.isHidden]: targetStage === ArticleStage.DRAFT,
                    })}
                  />
                  <div
                    className={cx(classes.dot, {
                      [classes.notActive]:
                        !data[targetStage]?.time && !data[targetStage]?.member,
                    })}
                  />
                  <div
                    className={cx(classes.bottomLine, {
                      [classes.isHidden]: targetStage === ArticleStage.RELEASED,
                    })}
                  />
                </div>
                <div className={classes.contentWrapper}>
                  <div className={classes.stageWrapper}>
                    <Typography variant="h5" color="text-primary">
                      {getStageNaming(targetStage).stageName}
                    </Typography>
                    {!versionMode && !!data[targetStage]?.version && (
                      <Button
                        type="button"
                        variant="text"
                        color="secondary"
                        size="small"
                        onClick={() => {
                          setVersionMode(true);
                        }}
                      >
                        {`Ver. ${data[targetStage].version}`}
                      </Button>
                    )}
                  </div>
                  <div className={classes.list}>
                    <div className={classes.option}>
                      <Typography variant="h6" color="text-secondary">
                        {getStageNaming(targetStage).timeTitle}
                      </Typography>
                      <Typography variant="body2" color="text-primary">
                        {data[targetStage]?.time || '-'}
                      </Typography>
                    </div>
                    <div className={classes.option}>
                      <Typography variant="h6" color="text-secondary">
                        {getStageNaming(targetStage).memberTitle}
                      </Typography>
                      <Typography variant="body2" color="text-primary">
                        {data[targetStage]?.member || '-'}
                      </Typography>
                    </div>
                  </div>
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
            display: versionMode ? 'flex' : 'none',
          },
        }}
        confirmButtonProps={{
          type: 'button',
          size: 'large',
          variant: 'contained',
          danger: false,
        }}
        onCancel={() => {
          setVersionMode(false);
        }}
        onConfirm={closeModal}
      />
    </>
  );
};

export { LogsModal };
