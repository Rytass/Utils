import React from 'react';

export interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  color?: string;
}

export const PenToolIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M17.0707 12.9861L15.034 6.66338L4 4M4 4L6.66338 15.034L12.9861 17.0707M4 4L10.1971 10.1971M12.9861 11.3523C12.9861 12.2546 12.2546 12.9861 11.3523 12.9861C10.4499 12.9861 9.71843 12.2546 9.71843 11.3523C9.71843 10.4499 10.4499 9.71843 11.3523 9.71843C12.2546 9.71843 12.9861 10.4499 12.9861 11.3523Z"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <rect
      x="12.6872"
      y="17.3848"
      width="6.6425"
      height="3.40799"
      transform="rotate(-45 12.6872 17.3848)"
      stroke={color}
      strokeWidth="1.4"
    />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M3 6H5H21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth="2" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="2" />
    <path d="M21 15L16 10L5 21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SquareIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke={color} strokeWidth="2" />
  </svg>
);

export const PointerIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <mask id="path-1-inside-1_pointer" fill="white">
      <path d="M5.02328 5.74789C4.89692 5.30564 5.30564 4.89692 5.74789 5.02328L18.1502 8.56625C18.6081 8.69707 18.7272 9.29026 18.3553 9.58774L16.0164 12.1551L20.8114 16.9491L16.9491 20.8114L12.1551 16.0164L9.58774 18.3553C9.29026 18.7272 8.69707 18.6081 8.56625 18.1502L5.02328 5.74789Z" />
    </mask>
    <path
      d="M5.02328 5.74789L6.36943 5.36334L6.36942 5.36328L5.02328 5.74789ZM5.74789 5.02328L5.36328 6.36942L5.36334 6.36943L5.74789 5.02328ZM18.1502 8.56625L18.5348 7.22012L18.5348 7.2201L18.1502 8.56625ZM18.3553 9.58774L17.4807 8.49452L17.3946 8.5634L17.3204 8.64492L18.3553 9.58774ZM16.0164 12.1551L14.9815 11.2123L14.0815 12.2003L15.0266 13.1452L16.0164 12.1551ZM20.8114 16.9491L21.8013 17.939L22.7914 16.949L21.8012 15.959L20.8114 16.9491ZM16.9491 20.8114L15.959 21.8012L16.949 22.7914L17.939 21.8013L16.9491 20.8114ZM12.1551 16.0164L13.1452 15.0266L12.2003 14.0815L11.2123 14.9815L12.1551 16.0164ZM9.58774 18.3553L8.64492 17.3204L8.5634 17.3946L8.49452 17.4807L9.58774 18.3553ZM8.56625 18.1502L7.2201 18.5348L7.22012 18.5348L8.56625 18.1502ZM5.02328 5.74789L6.36942 5.36328C6.5448 5.97712 5.97712 6.5448 5.36328 6.36942L5.74789 5.02328L6.1325 3.67715C4.63415 3.24905 3.24905 4.63415 3.67715 6.1325L5.02328 5.74789ZM5.74789 5.02328L5.36334 6.36943L17.7657 9.9124L18.1502 8.56625L18.5348 7.2201L6.13245 3.67713L5.74789 5.02328ZM18.1502 8.56625L17.7656 9.91238C17.1297 9.73069 16.965 8.90711 17.4807 8.49452L18.3553 9.58774L19.2299 10.681C20.4893 9.67341 20.0865 7.66346 18.5348 7.22012L18.1502 8.56625ZM18.3553 9.58774L17.3204 8.64492L14.9815 11.2123L16.0164 12.1551L17.0514 13.0979L19.3903 10.5306L18.3553 9.58774ZM16.0164 12.1551L15.0266 13.1452L19.8215 17.9391L20.8114 16.9491L21.8012 15.959L17.0063 11.1651L16.0164 12.1551ZM20.8114 16.9491L19.8214 15.9591L15.9591 19.8214L16.9491 20.8114L17.939 21.8013L21.8013 17.939L20.8114 16.9491ZM16.9491 20.8114L17.9391 19.8215L13.1452 15.0266L12.1551 16.0164L11.1651 17.0063L15.959 21.8012L16.9491 20.8114ZM12.1551 16.0164L11.2123 14.9815L8.64492 17.3204L9.58774 18.3553L10.5306 19.3903L13.0979 17.0514L12.1551 16.0164ZM9.58774 18.3553L8.49452 17.4807C8.90711 16.965 9.73069 17.1297 9.91238 17.7656L8.56625 18.1502L7.22012 18.5348C7.66346 20.0865 9.67341 20.4893 10.681 19.2299L9.58774 18.3553ZM8.56625 18.1502L9.9124 17.7657L6.36943 5.36334L5.02328 5.74789L3.67713 6.13245L7.2201 18.5348L8.56625 18.1502Z"
      fill={color}
      mask="url(#path-1-inside-1_pointer)"
    />
  </svg>
);

export const RedoIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <mask id="mask0_redo" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect width="24" height="24" fill="#D9D9D9" />
    </mask>
    <g mask="url(#mask0_redo)">
      <path
        d="M9.32091 17.7C8.14141 17.7 7.14266 17.2686 6.32466 16.4058C5.50666 15.5429 5.09766 14.5122 5.09766 13.3135C5.09766 12.1148 5.50666 11.0857 6.32466 10.226C7.14266 9.36633 8.14141 8.9365 9.32091 8.9365H16.1919L13.6844 6.42875L14.6132 5.5L18.6997 9.5865L14.6132 13.673L13.6844 12.7442L16.1919 10.2365H9.32091C8.49391 10.2365 7.79999 10.5378 7.23916 11.1403C6.67816 11.7429 6.39766 12.4673 6.39766 13.3135C6.39766 14.1597 6.67816 14.8856 7.23916 15.4913C7.79999 16.0971 8.49391 16.4 9.32091 16.4H16.5977V17.7H9.32091Z"
        fill={color}
      />
    </g>
  </svg>
);

export const UndoIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <mask id="mask0_undo" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect width="24" height="24" fill="#D9D9D9" />
    </mask>
    <g mask="url(#mask0_undo)">
      <path
        d="M7.4018 17.7V16.4H14.6786C15.5056 16.4 16.1995 16.0971 16.7603 15.4913C17.3213 14.8856 17.6018 14.1597 17.6018 13.3135C17.6018 12.4673 17.3213 11.7429 16.7603 11.1403C16.1995 10.5377 15.5056 10.2365 14.6786 10.2365H7.80755L10.3151 12.7442L9.3863 13.673L5.2998 9.5865L9.3863 5.5L10.3151 6.42875L7.80755 8.9365H14.6786C15.8581 8.9365 16.8568 9.36633 17.6748 10.226C18.4928 11.0857 18.9018 12.1148 18.9018 13.3135C18.9018 14.5122 18.4928 15.5429 17.6748 16.4058C16.8568 17.2686 15.8581 17.7 14.6786 17.7H7.4018Z"
        fill={color}
      />
    </g>
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ width = 24, height = 24, className, color = '#8F8F8F' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
