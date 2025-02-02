export const GraphQLContextTokenResolver = async (context: {
  req: { headers: Record<string, string> };
}): Promise<{ token: string | null }> => {
  try {
    const token = (context.req.headers.authorization || '')
      .replace(/^Bearer\s/, '')
      .trim();

    return {
      ...context,
      token,
    };
  } catch (ex) {
    return {
      ...context,
      token: null,
    };
  }
};
