import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

import { CreateProductDto, ReduceStockDto } from '@app/common';
import { CACHE_KEYS, CACHE_TTL } from '@app/common';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    @InjectPinoLogger(ProductService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    this.logger.info({ dto }, 'Creating new product');

    const product = new this.productModel(dto);
    const saved = await product.save();

    // Invalidate all-products cache after create
    await this.cacheManager.del(CACHE_KEYS.ALL_PRODUCTS);
    this.logger.info(
      { productId: saved._id },
      'Product created successfully, cache invalidated',
    );

    return saved;
  }

  async findAll(): Promise<Product[]> {
    this.logger.info('Fetching all products');

    const cached = await this.cacheManager.get<Product[]>(
      CACHE_KEYS.ALL_PRODUCTS,
    );
    if (cached) {
      this.logger.debug('Cache HIT for all products');
      return cached;
    }

    this.logger.debug('Cache MISS for all products — querying MongoDB');
    const products = await this.productModel.find().lean().exec();

    await this.cacheManager.set(
      CACHE_KEYS.ALL_PRODUCTS,
      products,
      CACHE_TTL.PRODUCTS,
    );
    this.logger.info({ count: products.length }, 'Products fetched and cached');

    return products;
  }

  async findOne(id: string): Promise<Product> {
    this.logger.info({ productId: id }, 'Fetching product by id');

    const cacheKey = CACHE_KEYS.PRODUCT_BY_ID(id);
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) {
      this.logger.debug({ productId: id }, 'Cache HIT for product');
      return cached;
    }

    this.logger.debug(
      { productId: id },
      'Cache MISS for product — querying MongoDB',
    );
    const product = await this.productModel.findById(id).lean().exec();

    if (!product) {
      this.logger.warn({ productId: id }, 'Product not found');
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, product, CACHE_TTL.PRODUCT_BY_ID);
    this.logger.info({ productId: id }, 'Product fetched and cached');

    return product;
  }

  async reduceStock(
    dto: ReduceStockDto,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info(
      { productId: dto.productId, quantity: dto.quantity },
      'Reducing product stock',
    );

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) {
      this.logger.warn(
        { productId: dto.productId },
        'Product not found for stock reduction',
      );
      return { success: false, error: `Product ${dto.productId} not found` };
    }

    if (product.stock < dto.quantity) {
      this.logger.warn(
        {
          productId: dto.productId,
          available: product.stock,
          requested: dto.quantity,
        },
        'Insufficient stock',
      );
      return {
        success: false,
        error: `Insufficient stock. Available: ${product.stock}, Requested: ${dto.quantity}`,
      };
    }

    product.stock -= dto.quantity;
    await product.save();

    // Invalidate caches for this product and product list
    const cacheKey = CACHE_KEYS.PRODUCT_BY_ID(dto.productId);
    await Promise.all([
      this.cacheManager.del(cacheKey),
      this.cacheManager.del(CACHE_KEYS.ALL_PRODUCTS),
    ]);

    this.logger.info(
      { productId: dto.productId, newStock: product.stock },
      'Stock reduced successfully, cache invalidated',
    );

    return { success: true };
  }
}
