import { ArticlesPermissions } from '../typings';

export function havePermission({
  userPermissions,
  targetPermission,
}: {
  userPermissions: ArticlesPermissions[];
  targetPermission: ArticlesPermissions;
}): boolean {
  return !!userPermissions.find((p) => p === targetPermission);
}
