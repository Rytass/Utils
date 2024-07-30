import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BaseCategoryEntity } from '../models/base-category.entity';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
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
import { DEFAULT_LANGUAGE } from '../constant/default-language';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  CategoryBaseDto,
  SingleCategoryBaseDto,
} from '../typings/category-base.dto';
import { Language } from '../typings/language';
import { CategoryDataLoader } from '../data-loaders/category.dataloader';

@Injectable()
export class CategoryBaseService {
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

  private getDefaultQueryBuilder(
    alias = 'categories',
  ): SelectQueryBuilder<BaseCategoryEntity> {
    const qb = this.baseCategoryRepo.createQueryBuilder(alias);

    qb.innerJoinAndSelect(`${alias}.multiLanguageNames`, 'multiLanguageNames');
    qb.leftJoinAndSelect(`${alias}.children`, 'children');
    qb.leftJoinAndSelect(
      'children.multiLanguageNames',
      'childrenMultiLanguageNames',
    );

    return qb;
  }

  private parseSingleLanguageCategory(
    category: BaseCategoryEntity,
    language: Language = DEFAULT_LANGUAGE,
  ): SingleCategoryBaseDto {
    const multiLanguageName = category.multiLanguageNames.find(
      (multiLanguageName) => multiLanguageName.language === language,
    ) as BaseCategoryMultiLanguageNameEntity;

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
          this.parseSingleLanguageCategory(childCategory),
        ) ?? [],
    };
  }

  private async getParentCategoryIdSet(
    id: string,
    givenSet = new Set<string>(),
  ): Promise<Set<string>> {
    const foundCategory = (await this.categoryDataLoader.withParentsLoader.load(
      id,
    )) as BaseCategoryEntity;

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

  private async checkCircularCategories(
    category: BaseCategoryEntity,
    targetParents: BaseCategoryEntity[],
  ): Promise<void> {
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
      throw new BadRequestException('Circular category is not allowed');
    }
  }

  public async findAll(
    options?: CategoryFindAllDto & { language: Language },
  ): Promise<SingleCategoryBaseDto[]>;
  public async findAll(
    options?: CategoryFindAllDto,
  ): Promise<CategoryBaseDto[]>;
  public async findAll(
    options?: CategoryFindAllDto,
  ): Promise<CategoryBaseDto[]> {
    const qb = this.getDefaultQueryBuilder('categories');

    if (options?.ids) {
      qb.andWhere('categories.id IN (:...ids)', { ids: options.ids });
    }

    if (options?.fromTop) {
      qb.leftJoin('categories.parents', 'fromTopParents');

      qb.andWhere('fromTopParents.id IS NULL');
    }

    const categories = await qb.getMany();

    if (options?.language || !this.multipleLanguageMode) {
      return categories.map((category) =>
        this.parseSingleLanguageCategory(category, options?.language),
      );
    }

    return categories;
  }

  async findById(
    id: string,
    language: Language,
  ): Promise<SingleCategoryBaseDto>;
  async findById(id: string): Promise<CategoryBaseDto>;
  async findById(id: string, language?: Language): Promise<CategoryBaseDto> {
    const qb = this.getDefaultQueryBuilder('categories');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    if (language || !this.multipleLanguageMode) {
      return this.parseSingleLanguageCategory(category, language);
    }

    return category;
  }

  async archive(id: string): Promise<void> {
    const category = await this.baseCategoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    await this.baseCategoryRepo.softDelete(id);
  }

  async update(
    id: string,
    options: CategoryCreateDto,
  ): Promise<BaseCategoryEntity> {
    if (!this.allowMultipleParentCategories && options.parentIds?.length) {
      throw new BadRequestException(
        'Multiple parent categories not allowed, please enable on module forRoot options',
      );
    }

    const qb = this.getDefaultQueryBuilder('categories');

    qb.leftJoinAndSelect('categories.parents', 'parents');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    let parentCategories: BaseCategoryEntity[] = [];

    if (
      (options.parentIds?.length || options.parentId) &&
      this.allowMultipleParentCategories
    ) {
      parentCategories = await this.baseCategoryRepo.find({
        where: {
          id: In(
            options.parentIds?.length ? options.parentIds : [options.parentId],
          ),
        },
        relations: ['parents'],
      });

      if (parentCategories.length !== (options.parentIds?.length ?? 1)) {
        throw new BadRequestException('Parent category not found');
      }
    }

    if (options.parentId && !this.allowMultipleParentCategories) {
      const parentCategory = await this.baseCategoryRepo.findOne({
        where: {
          id: options.parentId,
        },
        relations: ['parents'],
      });

      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }

      parentCategories = [parentCategory];
    }

    if (!this.allowCircularCategories) {
      await this.checkCircularCategories(category, parentCategories);
    }

    category.bindable = options.bindable ?? true;
    category.parents = parentCategories;

    let willRemoveLanguages: BaseCategoryMultiLanguageNameEntity[] = [];
    let willCreateOrUpdateLanguages: BaseCategoryMultiLanguageNameEntity[] = [];

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
      );

      willCreateOrUpdateLanguages = Object.entries(
        options.multiLanguageNames ?? {},
      ).map(([language, name]) => {
        const existed = existedLanguage.get(language);

        if (existed) {
          existed.name = name;

          return existed;
        }

        return this.baseCategoryMultiLanguageNameRepo.create({
          categoryId: category.id,
          language,
          name,
        });
      });
    } else {
      const defaultLanguage = category.multiLanguageNames.find(
        (multiLanguageName) => multiLanguageName.language === DEFAULT_LANGUAGE,
      );

      if (defaultLanguage) {
        defaultLanguage.name = options.name;

        willCreateOrUpdateLanguages = [defaultLanguage];
      } else {
        willCreateOrUpdateLanguages = [
          this.baseCategoryMultiLanguageNameRepo.create({
            categoryId: category.id,
            language: DEFAULT_LANGUAGE,
            name: options.name,
          }),
        ];
      }
    }

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();
    await runner.startTransaction();

    try {
      await runner.manager.save(category);
      await runner.manager.remove(willRemoveLanguages);
      await runner.manager.save(willCreateOrUpdateLanguages);

      await runner.commitTransaction();

      return category;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }

  async create(options: CategoryCreateDto): Promise<BaseCategoryEntity> {
    let parentCategories: BaseCategoryEntity[] = [];

    if (!this.allowMultipleParentCategories && options.parentIds?.length) {
      throw new BadRequestException(
        'Multiple parent categories not allowed, please enable on module forRoot options',
      );
    }

    if (
      (options.parentIds?.length || options.parentId) &&
      this.allowMultipleParentCategories
    ) {
      parentCategories = await this.baseCategoryRepo.find({
        where: {
          id: In(
            options.parentIds?.length ? options.parentIds : [options.parentId],
          ),
        },
      });

      if (parentCategories.length !== (options.parentIds?.length ?? 1)) {
        throw new BadRequestException('Parent category not found');
      }
    }

    if (options.parentId && !this.allowMultipleParentCategories) {
      const parentCategory = await this.baseCategoryRepo.findOne({
        where: {
          id: options.parentId,
        },
      });

      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }

      parentCategories = [parentCategory];
    }

    const category = this.baseCategoryRepo.create({
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
                categoryId: category.id,
                language,
                name,
              }),
          ),
        );
      } else {
        await runner.manager.save(
          this.baseCategoryMultiLanguageNameRepo.create({
            categoryId: category.id,
            language: DEFAULT_LANGUAGE,
            name: options.name,
          }),
        );
      }

      await runner.commitTransaction();

      return category;
    } catch (ex) {
      await runner.rollbackTransaction();

      throw new BadRequestException(ex);
    } finally {
      await runner.release();
    }
  }
}
