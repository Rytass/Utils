import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BaseCategoryEntity } from '../models/base-category.entity';
import {
  DataSource,
  DeepPartial,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
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
import { CategoryBaseDto } from '../typings/category-base.dto';
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
  CategoryEntity extends BaseCategoryEntity = BaseCategoryEntity,
  CategoryMultiLanguageNameEntity extends
    BaseCategoryMultiLanguageNameEntity = BaseCategoryMultiLanguageNameEntity,
> {
  constructor(
    @Inject(RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO)
    private readonly baseCategoryMultiLanguageNameRepo: Repository<BaseCategoryMultiLanguageNameEntity>,
    @Inject(RESOLVED_CATEGORY_REPO)
    private readonly baseCategoryRepo: Repository<BaseCategoryEntity>,
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

  private getDefaultQueryBuilder<C extends CategoryEntity = CategoryEntity>(
    alias = 'categories',
  ): SelectQueryBuilder<C> {
    const qb = this.baseCategoryRepo.createQueryBuilder(alias);

    qb.innerJoinAndSelect(`${alias}.multiLanguageNames`, 'multiLanguageNames');
    qb.leftJoinAndSelect(`${alias}.children`, 'children');
    qb.leftJoinAndSelect(
      'children.multiLanguageNames',
      'childrenMultiLanguageNames',
    );

    return qb as SelectQueryBuilder<C>;
  }

  private parseSingleLanguageCategory<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(category: C, language: Language = DEFAULT_LANGUAGE): SingleCategoryBaseDto {
    const multiLanguageName = category.multiLanguageNames.find(
      (multiLanguageName) => multiLanguageName.language === language,
    ) as CM;

    return {
      id: category.id,
      bindable: category.bindable,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
      language: multiLanguageName.language,
      name: multiLanguageName.name,
      children:
        category.children?.map((childCategory) =>
          this.parseSingleLanguageCategory(childCategory as C),
        ) ?? [],
    };
  }

  private async getParentCategoryIdSet(
    id: string,
    givenSet = new Set<string>(),
  ): Promise<Set<string>> {
    const foundCategory = (await this.categoryDataLoader.withParentsLoader.load(
      id,
    )) as CategoryEntity;

    givenSet.add(id);

    if (foundCategory.parents.length) {
      return foundCategory.parents
        .map(
          (parent) => (set: Set<string>) =>
            this.getParentCategoryIdSet(parent.id, set),
        )
        .reduce((prev, next) => prev.then(next), Promise.resolve(givenSet));
    }

    return givenSet;
  }

  private async checkCircularCategories<
    C extends CategoryEntity = CategoryEntity,
  >(category: C, targetParents: C[]): Promise<void> {
    const allParentIdSet = await targetParents
      .map(
        (parent) => (set: Set<string>) =>
          this.getParentCategoryIdSet(parent.id, set),
      )
      .reduce(
        (prev, next) => prev.then(next),
        Promise.resolve(new Set<string>()),
      );

    if (allParentIdSet.has(category.id)) {
      throw new CircularCategoryNotAllowedError();
    }
  }

  public async findAll<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(
    options?: CategoryFindAllDto & { language: Language },
  ): Promise<SingleCategoryBaseDto<C, CM>[]>;
  public async findAll<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(options?: CategoryFindAllDto): Promise<CategoryBaseDto<C, CM>[]>;
  public async findAll<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(options?: CategoryFindAllDto): Promise<CategoryBaseDto<C, CM>[]> {
    const qb = this.getDefaultQueryBuilder('categories');

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
      return categories.map((category) =>
        this.parseSingleLanguageCategory(category, options?.language),
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

    return categories as CategoryBaseDto<C, CM>[];
  }

  async findById<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(id: string, language: Language): Promise<SingleCategoryBaseDto<C, CM>>;
  async findById<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(id: string): Promise<CategoryBaseDto<C, CM>>;
  async findById<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(id: string, language?: Language): Promise<CategoryBaseDto<C, CM>> {
    const qb = this.getDefaultQueryBuilder('categories');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (language || !this.multipleLanguageMode) {
      return this.parseSingleLanguageCategory(category, language);
    }

    return category as CategoryBaseDto<C, CM>;
  }

  async archive(id: string): Promise<void> {
    const category = await this.baseCategoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new CategoryNotFoundError();
    }

    await this.baseCategoryRepo.softDelete(id);
  }

  async update<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(
    id: string,
    options: CategoryCreateDto<C>,
    multiLanguageOptions?: DeepPartial<CM>,
  ): Promise<CategoryBaseDto<C, CM>> {
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

    if (
      (options.parentIds?.length || options.parentId) &&
      this.allowMultipleParentCategories
    ) {
      parentCategories = (await this.baseCategoryRepo.find({
        where: {
          id: In(
            options.parentIds?.length ? options.parentIds : [options.parentId],
          ),
        },
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
        },
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

    let willRemoveLanguages: CM[] = [];
    let willCreateOrUpdateLanguages: CM[] = [];

    if ('multiLanguageNames' in options) {
      if (!this.multipleLanguageMode)
        throw new InternalServerErrorException(
          'Multiple language mode is not enabled',
        );

      const existedLanguage = new Map(
        category.multiLanguageNames.map((multiLanguageName) => [
          multiLanguageName.language,
          multiLanguageName,
        ]),
      );

      const nextLanguageSet = new Set(
        Object.keys(options.multiLanguageNames ?? {}),
      );

      willRemoveLanguages = category.multiLanguageNames.filter(
        (multiLanguageName) => !nextLanguageSet.has(multiLanguageName.language),
      ) as CM[];

      willCreateOrUpdateLanguages = Object.entries(
        options.multiLanguageNames ?? {},
      ).map(([language, name]) => {
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
        });
      }) as CM[];
    } else {
      const defaultLanguage = category.multiLanguageNames.find(
        (multiLanguageName) => multiLanguageName.language === DEFAULT_LANGUAGE,
      );

      if (defaultLanguage) {
        willCreateOrUpdateLanguages = [
          this.baseCategoryMultiLanguageNameRepo.create({
            ...(multiLanguageOptions ?? {}),
            ...defaultLanguage,
            name: options.name,
          }),
        ] as CM[];
      } else {
        willCreateOrUpdateLanguages = [
          this.baseCategoryMultiLanguageNameRepo.create({
            ...(multiLanguageOptions ?? {}),
            categoryId: category.id,
            language: DEFAULT_LANGUAGE,
            name: options.name,
          }),
        ] as CM[];
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

      return this.findById<C, CM>(category.id);
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }

  async create<
    C extends CategoryEntity = CategoryEntity,
    CM extends
      CategoryMultiLanguageNameEntity = CategoryMultiLanguageNameEntity,
  >(
    options: CategoryCreateDto<C>,
    multiLanguageOptions?: DeepPartial<CM>,
  ): Promise<CategoryBaseDto<C, CM>> {
    let parentCategories: C[] = [];

    if (!this.allowMultipleParentCategories && options.parentIds?.length) {
      throw new MultipleParentCategoryNotAllowedError();
    }

    if (
      (options.parentIds?.length || options.parentId) &&
      this.allowMultipleParentCategories
    ) {
      parentCategories = (await this.baseCategoryRepo.find({
        where: {
          id: In(
            options.parentIds?.length ? options.parentIds : [options.parentId],
          ),
        },
      })) as C[];

      if (parentCategories.length !== (options.parentIds?.length ?? 1)) {
        throw new ParentCategoryNotFoundError();
      }
    }

    if (options.parentId && !this.allowMultipleParentCategories) {
      const parentCategory = await this.baseCategoryRepo.findOne({
        where: {
          id: options.parentId,
        },
      });

      if (!parentCategory) {
        throw new ParentCategoryNotFoundError();
      }

      parentCategories = [parentCategory] as C[];
    }

    const category = this.baseCategoryRepo.create({
      ...(options as DeepPartial<C>),
      bindable: options.bindable ?? true,
      parents: parentCategories,
    });

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(category);

      if ('multiLanguageNames' in options) {
        if (!this.multipleLanguageMode)
          throw new InternalServerErrorException(
            'Multiple language mode is not enabled',
          );

        await runner.manager.save(
          Object.entries(options.multiLanguageNames ?? {}).map(
            ([language, name]) =>
              this.baseCategoryMultiLanguageNameRepo.create({
                ...((multiLanguageOptions ?? {}) as CM),
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
          }),
        );
      }

      await runner.commitTransaction();

      return this.findById<C, CM>(category.id);
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
