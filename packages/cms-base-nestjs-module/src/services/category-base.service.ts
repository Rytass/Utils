import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  BaseCategoryEntity,
  BaseCategoryRepo,
} from '../models/base-category.entity';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { MULTIPLE_LANGUAGE_MODE } from '../typings/cms-base-providers';
import { CategoryCreateDto } from '../typings/category-create.dto';
import {
  BaseCategoryMultiLanguageNameEntity,
  BaseCategoryMultiLanguageNameRepo,
} from '../models/base-category-multi-language-name.entity';
import { CategoryFindAllDto } from '../typings/category-find-all.dto';
import { DEFAULT_LANGUAGE } from '../constant/default-language';

@Injectable()
export class CategoryBaseService {
  constructor(
    @Inject(BaseCategoryMultiLanguageNameRepo)
    private readonly baseCategoryMultiLanguageNameRepo: Repository<BaseCategoryMultiLanguageNameEntity>,
    @Inject(BaseCategoryRepo)
    private readonly baseCategoryRepo: Repository<BaseCategoryEntity>,
    @Inject(MULTIPLE_LANGUAGE_MODE)
    private readonly multipleLanguageMode: boolean,
    private readonly dataSource: DataSource,
  ) {}

  private getDefaultQueryBuilder(
    alias = 'categories',
  ): SelectQueryBuilder<BaseCategoryEntity> {
    const qb = this.baseCategoryRepo.createQueryBuilder(alias);

    qb.innerJoinAndSelect(`${alias}.multiLanguageNames`, 'multiLanguageNames');
    qb.leftJoinAndSelect(`${alias}.children`, 'children');

    return qb;
  }

  async findAll(options: CategoryFindAllDto): Promise<BaseCategoryEntity[]> {
    const qb = this.getDefaultQueryBuilder('categories');

    if (options.ids) {
      qb.andWhere('categories.id IN (:...ids)', { ids: options.ids });
    }

    const categories = await qb.getMany();

    return categories;
  }

  async findById(id: string): Promise<BaseCategoryEntity> {
    const qb = this.getDefaultQueryBuilder('categories');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new BadRequestException('Category not found');
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
    const qb = this.getDefaultQueryBuilder('categories');

    qb.leftJoinAndSelect('categories.parents', 'parents');

    qb.andWhere('categories.id = :id', { id });

    const category = await qb.getOne();

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    let parentCategories: BaseCategoryEntity[] = [];

    if (options.parentIds?.length) {
      parentCategories = await this.findAll({ ids: options.parentIds });

      if (parentCategories.length !== options.parentIds.length) {
        throw new BadRequestException('Parent category not found');
      }
    }

    category.bindable = options.bindable ?? false;
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

    if (options.parentIds?.length) {
      parentCategories = await this.findAll({ ids: options.parentIds });

      if (parentCategories.length !== options.parentIds.length) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = this.baseCategoryRepo.create({
      bindable: options.bindable ?? false,
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