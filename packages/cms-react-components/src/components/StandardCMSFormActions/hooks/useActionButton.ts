export function useActionButton(): {
  text: string;
  onAction?: () => Promise<void>;
} {
  return {
    text: '儲存草稿',
    onAction: async () => {},
  };
}
