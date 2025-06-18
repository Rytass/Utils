export function useSubmitButton(): {
  text: string;
  onSubmit?: () => Promise<void>;
} {
  return {
    text: '送審',
    onSubmit: async () => {},
  };
}
