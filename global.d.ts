declare module 'css-box-model' {
  export interface Position {
    x: number;
    y: number;
  }

  export interface Spacing {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  export interface Rect {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
    x: number;
    y: number;
    center: Position;
  }

  export interface BoxModel {
    marginBox: Rect;
    borderBox: Rect;
    paddingBox: Rect;
    contentBox: Rect;
    margin: Spacing;
    border: Spacing;
    padding: Spacing;
    borderRadius?: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    };
  }
}

declare module '*.module.scss' {
  const classes: Record<string, string>;

  export default classes;
}
