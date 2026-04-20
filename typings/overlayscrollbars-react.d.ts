/**
 * overlayscrollbars-react@0.5.6 的 OverlayScrollbarsComponent.d.ts 使用
 * T extends ElementType 搭配 ComponentPropsWithoutRef<T> 與 ElementRef<T>，
 * 但 React 19 的 @types/react 收緊了 ComponentProps / ElementRef 的 constraint，
 * 導致型別不相容。
 *
 * 此檔案透過 tsconfig paths 取代原始型別宣告，將 T 的 constraint 改為
 * 與 React 19 相容的聯合型別。
 */
declare module 'overlayscrollbars-react' {
  import type { OverlayScrollbars, PartialOptions, EventListeners, InitializationTarget } from 'overlayscrollbars';
  import type { ComponentPropsWithoutRef, ForwardedRef, ReactElement, ReactNode } from 'react';

  type ValidElementType =
    | keyof React.JSX.IntrinsicElements
    | React.ForwardRefExoticComponent<any>
    | (new (props: any, context: any) => React.Component<any>)
    | ((props: any) => ReactNode);

  type OverlayScrollbarsComponentBaseProps<T extends ValidElementType = 'div'> =
    ComponentPropsWithoutRef<T> & {
      element?: T;
      options?: PartialOptions | false | null;
      events?: EventListeners | false | null;
      defer?: boolean | IdleRequestOptions;
    };

  export type OverlayScrollbarsComponentProps<T extends ValidElementType = 'div'> =
    OverlayScrollbarsComponentBaseProps<T> & {
      ref?: ForwardedRef<OverlayScrollbarsComponentRef<T>>;
    };

  export interface OverlayScrollbarsComponentRef<T extends ValidElementType = 'div'> {
    osInstance(): OverlayScrollbars | null;
    getElement(): Element | null;
  }

  export const OverlayScrollbarsComponent: <T extends ValidElementType = 'div'>(
    props: OverlayScrollbarsComponentProps<T>,
  ) => ReactElement | null;

  export interface UseOverlayScrollbarsParams {
    options?: OverlayScrollbarsComponentProps['options'];
    events?: OverlayScrollbarsComponentProps['events'];
    defer?: OverlayScrollbarsComponentProps['defer'];
  }

  export type UseOverlayScrollbarsInitialization = (target: InitializationTarget) => void;
  export type UseOverlayScrollbarsInstance = () => OverlayScrollbars | null;

  export const useOverlayScrollbars: (
    params?: UseOverlayScrollbarsParams,
  ) => [UseOverlayScrollbarsInitialization, UseOverlayScrollbarsInstance];
}
