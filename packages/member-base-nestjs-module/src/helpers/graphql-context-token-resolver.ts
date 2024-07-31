export const GraphQLContextTokenResolver = async ({
  req,
}: {
  req: { headers: Record<string, string> };
}): Promise<{ token: string | null }> => {
  try {
    const token = (req.headers.authorization || '')
      .replace(/^Bearer\s/, '')
      .trim();

    return {
      token,
    };
  } catch (ex) {
    return {
      token: null,
    };
  }
};
