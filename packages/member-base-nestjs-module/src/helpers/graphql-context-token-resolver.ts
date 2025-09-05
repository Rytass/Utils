export const GraphQLContextTokenResolver = async (context: {
  req: { headers: Record<string, string>; cookies: Record<string, string> };
}): Promise<{ token: string | null }> => {
  try {
    const token = (context.req.headers.authorization || context.req.cookies?.token || '')
      .replace(/^Bearer\s/, '')
      .trim();

    return {
      ...context,
      token,
    };
  } catch (_ex) {
    return {
      ...context,
      token: null,
    };
  }
};
