import type { ObjectLiteral, Repository } from 'typeorm';

type FindOne = (options: { where: unknown }) => Promise<unknown>;

/**
 * Give a hand-rolled repository double the one path `MemberBaseService` uses
 * to read a member from the primary: `manager.connection.createQueryRunner`
 * and that runner's `manager.findOne`, answered by the double's own `findOne`.
 *
 * Every mode a runner is asked for is recorded on the returned array, so a
 * spec can assert that no member read went anywhere but the primary. The read
 * must name the repository's own `target`: with a custom member entity that is
 * the subclass, and naming the base class instead would drop its discriminator.
 */
export const withPrimaryReads = <T extends ObjectLiteral>(
  repo: Repository<T>,
  target: unknown = 'BaseMemberEntity',
): string[] => {
  const modes: string[] = [];
  const findOne = (repo as unknown as { findOne: FindOne }).findOne;

  Object.assign(repo, {
    target,
    manager: {
      connection: {
        createQueryRunner: (mode: string): unknown => {
          modes.push(mode);

          return {
            manager: {
              findOne: (readTarget: unknown, options: { where: unknown }): Promise<unknown> => {
                if (readTarget !== target) {
                  throw new Error(`Member read from ${String(readTarget)} instead of the repository target`);
                }

                return findOne(options);
              },
            },
            release: async (): Promise<void> => undefined,
          };
        },
      },
    },
  });

  return modes;
};
