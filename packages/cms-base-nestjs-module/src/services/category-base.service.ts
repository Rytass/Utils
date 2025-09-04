import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { DataSource, DeepPartial, FindOneOptions, FindOptionsWhere, In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  CATEGORY_DATA_LOADER,
  CIRCULAR_CATEGORY_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../typings/cms-base-providers';
import { CategoryCreateDto } from '../typings/category-create.dto';
import { BaseCategoryMultiLanguageNameEntity } from '../models/base-category-multi-language-name.entity';
import { CategoryFindAllDto } from '../typings/category-find-all.dto';
import { DEFAULT_LANGUAGE } from '../constants/default-language';
import { InjectDataSource } from '@nestjs/typeorm';
import { CategoryBaseDto, MultiLanguageCategoryBaseDto } from '../typings/category-base.dto';
import { Language } from '../typings/language';
import { CategoryDataLoader } from '../data-loaders/category.dataloader';
import { CategorySorter } from '../typings/category-sorter.enum';
import {
  CategoryNotFoundError,
  CircularCategoryNotAllowedError,
  MultipleParentCategoryNotAllowedError,
  ParentCategoryNotFoundError,
} from '../constants/errors/category.errors';
import { SingleCategoryBaseDto } from '../typings/category-base.dto';

@Injectable()
export class CategoryBaseService<
  C extends BaseCategoryEntity = BaseCategoryEntity,
  CM extends BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> {
  constructor(
    @Inject(RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO)
    private readonly baseCategoryMultiLanguageNameRepo: Repository<CM>,
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly baseCategoryRepo: Repository<C>,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multipleLanguageMode: boolean,
    @Inject(MULTIPLE_CATEGORY_PARENT_MODE)
    private readonly allowMultipleParentCategories: boolean,
    @Inject(CIRCULAR_CATEGORY_MODE)
    private readonly allowCircularCategories: boolean,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(CATEGORY_DATA_LOADER)
    private readonly categoryDataLoader: CategoryDataLoader,
  ) {}

  private getDefaultQueryBuilder<T extends C = C>(alias = 'categories'): SelectQueryBuilder<T> {
    const qb = this.baseCategoryRepo.createQueryBuilder(alias);

    qb.innerJoinAndSelect(`${alias}.multiLanguageNames`, 'multiLanguageNames');
    qb.leftJoinAndSelect(`${alias}.children`, 'children');
    qb.leftJoinAndSelect('children.multiLanguageNames', 'childrenMultiLanguageNames');

    return qb as SelectQueryBuilder<T>;
  }

  private parseSingleLanguageCategory<T extends C = C, U extends CM = CM>(
    category: T & { multiLanguageNames: U[] },
    language: Language = DEFAULT_LANGUAGE,
  ): SingleCategoryBaseDto<T, U> {
    const { children, multiLanguageNames, parents, articles, ...columns } = category;

    const multiLanguageName = category.multiLanguageNames.find(
      multiLanguageName => multiLanguageName.language === language,
    ) as U;

    return {
      ...columns,
      ...multiLanguageName,
      children: (children ?? []).map(child =>
        this.parseSingleLanguageCategory<T, U>(child as T & { multiLanguageNames: U[] }),
      ),
      parents: (parents ?? []).map(parent =>
        this.parseSingleLanguageCategory<T, U>(parent as T & { multiLanguageNames: U[] }),
      ),
    };
  }

  private parseToMultiLanguageCategory<T extends C = C, U extends CM = CM>(
    category: T & { multiLanguageNames: U[] },
  ): MultiLanguageCategoryBaseDto<T, U> {
    const { parents, children, articles, multiLanguageNames, ...columns } = category;

    return {
      ...columns,
      children: (children ?? []).map(child =>
        this.parseToMultiLanguageCategory<T, U>(child as T & { multiLanguageNames: U[] }),
      ),
      parents: (parents ?? []).map(child =>
        this.parseToMultiLanguageCategory<T, U>(child as T & { multiLanguageNames: U[] }),
      ),
      multiLanguageNames,
    };
  }

  private async getParentCategoryIdSet(id: string, givenSet = new Set<string>()): Promise<Set<string>> {
    const foundCategory = (await this.categoryDataLoader.withParentsLoader.load(id)) as C;

    givenSet.add(id);

    if (foundCategory.parents.length) {
      return foundCategory.parents
        .map(parent => (set: Set<string>) => this.getParentCategoryIdSet(parent.id, set))
        .reduce((prev, next) => prev.then(next), Promise.resolve(givenSet));
    }

    return givenSet;
  }

  private async checkCircularCategories<T extends C = C>(category: T, targetParents: T[]): Promise<void> {
    const allParentIdSet = await targetParents
      .map(parent => (set: Set<string>) => this.getParentCategoryIdSet(parent.id, set))
      .reduce((prev, next) => prev.then(next), Promise.resolve(new Set<string>()));

    if (allParentIdSet.has(category.id)) {
      throw new CircularCategoryNotAllowedError();
    }
  }

  public async findAll<T extends C = C, U extends CM = CM>(
    options?: CategoryFindAllDto & { language: Language },
  ): Promise<SingleCategoryBaseDto<C, CM>[]>;
  public async findAll<T extends C = C, U extends CM = CM>(
    options?: CategoryFindAllDto,
  ): Promise<CategoryBaseDto<T, U>[]>;
  public async findAll<T extends C = C, U extends CM = CM>(
    options?: CategoryFindAllDto,
  ): Promise<CategoryBaseDto<T, U>[]> {
    const qb = this.getDefaultQueryBuilder<T>('categories');

    if (options?.ids) {
      qb.andWhere('categories.id IN (:...ids)', { ids: options.ids });
    }

    if (options?.fromTop) {
      qb.leftJoin('categories.parents', 'fromTopParents');

      qb.andWhere('fromTopParents.id IS NULL');
    }

    if (options?.parentIds?.length) {
      qb.innerJoin('categories.parents', 'parentForFilters');

      qb.andWhere('parentForFilters.id IN (:...parentIds)', {
        parentIds: options.parentIds,
      });
    }

    const categories = await qb.getMany();

    if (options?.language || !this.multipleLanguageMode) {
      return categories.map(category =>
        this.parseSingleLanguageCategory(category as T & { multiLanguageNames: U[] }, options?.language ?? undefined),
      );
    }

    switch (options?.sorter) {
      case CategorySorter.CREATED_AT_ASC:
        qb.addOrderBy('articles.createdAt', 'ASC');
        break;

      case CategorySorter.CREATED_AT_DESC:
      default:
        qb.addOrderBy('articles.createdAt', 'DESC');
        break;
    }

    qb.skip(options?.offset ?? 0);
    qb.take(Math.min(options?.limit ?? 20, 100));

    return categories.map(category => this.parseToMultiLanguageCategory(category as T & { multiLanguageNames: U[] }));
  }

  async findById<T extends C = C, U extends CM = CM>(
    id: string,
    language: Language,
  ): Promise<SingleCategoryBaseDto<T, U>>;
  async findById<T extends C = C, U extends CM = CM>(id: string): Promise<CategoryBaseDto<T, U>>;
  async findById<T extends C = C, U extends CM = CM>(id: string, language?: Language): Promise<CategoryBaseDto<T, U>> {
    const qb = this.getDefaultQueryBuilder<T>('categories');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (language || !this.multipleLanguageMode) {
      return this.parseSingleLanguageCategory<T, U>(category as T & { multiLanguageNames: U[] }, language);
    }

    return this.parseToMultiLanguageCategory<T, U>(category as T & { multiLanguageNames: U[] });
  }

  async archive(id: string): Promise<void> {
    const category = await this.baseCategoryRepo.findOne({
      where: { id },
    } as FindOneOptions<C>);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    await this.baseCategoryRepo.softDelete(id);
  }

  async update<T extends C = C, U extends CM = CM>(
    id: string,
    options: CategoryCreateDto<T>,
    multiLanguageOptions?: DeepPartial<U>,
  ): Promise<CategoryBaseDto<T, U>> {
    if (!this.allowMultipleParentCategories && options.parentIds?.length) {
      throw new MultipleParentCategoryNotAllowedError();
    }

    const qb = this.getDefaultQueryBuilder('categories');

    qb.leftJoinAndSelect('categories.parents', 'parents');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new CategoryNotFoundError();
    }

    let parentCategories: C[] = [];

    if ((options.parentIds?.length || options.parentId) && this.allowMultipleParentCategories) {
      parentCategories = (await this.baseCategoryRepo.find({
        where: {
          id: In(options.parentIds?.length ? options.parentIds : [options.parentId]),
        } as FindOptionsWhere<C>,
        relations: ['parents'],
      })) as C[];

      if (parentCategories.length !== (options.parentIds?.length ?? 1)) {
        throw new ParentCategoryNotFoundError();
      }
    }

    if (options.parentId && !this.allowMultipleParentCategories) {
      const parentCategory = (await this.baseCategoryRepo.findOne({
        where: {
          id: options.parentId,
        } as FindOptionsWhere<C>,
        relations: ['parents'],
      })) as C;

      if (!parentCategory) {
        throw new ParentCategoryNotFoundError();
      }

      parentCategories = [parentCategory];
    }

    if (!this.allowCircularCategories) {
      await this.checkCircularCategories(category, parentCategories);
    }

    let willRemoveLanguages: U[] = [];
    let willCreateOrUpdateLanguages: U[] = [];

    if ('multiLanguageNames' in options) {
      if (!this.multipleLanguageMode) throw new InternalServerErrorException('Multiple language mode is not enabled');

      const existedLanguage = new Map(
        category.multiLanguageNames.map(multiLanguageName => [multiLanguageName.language, multiLanguageName]),
      );

      const nextLanguageSet = new Set(Object.keys(options.multiLanguageNames ?? {}));

      willRemoveLanguages = category.multiLanguageNames.filter(
        multiLanguageName => !nextLanguageSet.has(multiLanguageName.language),
      ) as U[];

      willCreateOrUpdateLanguages = Object.entries(options.multiLanguageNames ?? {}).map(([language, name]) => {
        const existed = existedLanguage.get(language);

        if (existed) {
          existed.name = name;

          return existed;
        }

        return this.baseCategoryMultiLanguageNameRepo.create({
          ...(multiLanguageOptions ?? {}),
          categoryId: category.id,
          language,
          name,
        } as U);
      }) as U[];
    } else {
      const defaultLanguage = category.multiLanguageNames.find(
        multiLanguageName => multiLanguageName.language === DEFAULT_LANGUAGE,
      );

      if (defaultLanguage) {
        willCreateOrUpdateLanguages = [
          this.baseCategoryMultiLanguageNameRepo.create({
            ...(multiLanguageOptions ?? {}),
            ...defaultLanguage,
            name: options.name,
          } as U),
        ] as U[];
      } else {
        willCreateOrUpdateLanguages = [
          this.baseCategoryMultiLanguageNameRepo.create({
            ...(multiLanguageOptions ?? {}),
            categoryId: category.id,
            language: DEFAULT_LANGUAGE,
            name: options.name,
          } as U),
        ] as U[];
      }
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(
        this.baseCategoryRepo.create({
          ...category,
          ...options,
          bindable: options.bindable ?? true,
          parents: parentCategories,
        }),
      );

      await runner.manager.remove(willRemoveLanguages);
      await runner.manager.save(willCreateOrUpdateLanguages);

      await runner.commitTransaction();

      return this.findById<T, U>(category.id);
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }

  async create<T extends C = C, U extends CM = CM>(
    options: CategoryCreateDto<T>,
    multiLanguageOptions?: DeepPartial<U>,
  ): Promise<CategoryBaseDto<T, U>> {
    let parentCategories: T[] = [];

    if (!this.allowMultipleParentCategories && options.parentIds?.length) {
      throw new MultipleParentCategoryNotAllowedError();
    }

    if ((options.parentIds?.length || options.parentId) && this.allowMultipleParentCategories) {
      parentCategories = (await this.baseCategoryRepo.find({
        where: {
          id: In(options.parentIds?.length ? options.parentIds : [options.parentId]),
        } as FindOptionsWhere<T>,
      })) as T[];

      if (parentCategories.length !== (options.parentIds?.length ?? 1)) {
        throw new ParentCategoryNotFoundError();
      }
    }

    if (options.parentId && !this.allowMultipleParentCategories) {
      const parentCategory = await this.baseCategoryRepo.findOne({
        where: {
          id: options.parentId,
        } as FindOptionsWhere<T>,
      });

      if (!parentCategory) {
        throw new ParentCategoryNotFoundError();
      }

      parentCategories = [parentCategory] as T[];
    }

    const category = this.baseCategoryRepo.create({
      ...(options as DeepPartial<T>),
      bindable: options.bindable ?? true,
      parents: parentCategories,
    });

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(category);

      if ('multiLanguageNames' in options) {
        if (!this.multipleLanguageMode) throw new InternalServerErrorException('Multiple language mode is not enabled');

        await runner.manager.save(
          Object.entries(options.multiLanguageNames ?? {}).map(([language, name]) =>
            this.baseCategoryMultiLanguageNameRepo.create({
              ...((multiLanguageOptions ?? {}) as U),
              categoryId: category.id,
              language,
              name,
            }),
          ),
        );
      } else {
        await runner.manager.save(
          this.baseCategoryMultiLanguageNameRepo.create({
            ...(multiLanguageOptions ?? {}),
            categoryId: category.id,
            language: DEFAULT_LANGUAGE,
            name: options.name,
          } as U),
        );
      }

      await runner.commitTransaction();

      return this.findById<T, U>(category.id);
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
