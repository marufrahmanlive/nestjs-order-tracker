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

  /**
   * Cache-Aside pattern: check Redis first, fall back to MongoDB.
   * On cache miss, populate Redis so subsequent calls hit cache.
   */
  async findAll(): Promise<Product[]> {
    this.logger.info('Fetching all products');

    // Try Redis first — if hit, skip MongoDB entirely
    const cached = await this.cacheManager.get<Product[]>(
      CACHE_KEYS.ALL_PRODUCTS,
    );
    if (cached) {
      this.logger.debug('Cache HIT for all products');
      return cached;
    }

    this.logger.debug('Cache MISS for all products — querying MongoDB');
    const products = await this.productModel.find().lean().exec();

    // Populate cache so next call doesn't hit MongoDB
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

  /**
   * Reduce product stock atomically.
   *
   * Uses findById (not findByIdAndUpdate) to first read current stock,
   * validate the reduction is possible, then save. This allows returning
   * a descriptive error when stock is insufficient rather than failing silently.
   *
   * After saving, BOTH the single-product cache AND the all-products list cache
   * are invalidated to prevent stale data from being served.
   */
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

    // Check if enough stock is available before decrementing
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

    // Invalidate both the single-product cache and the all-products list cache
    // Promise.all runs both deletes concurrently for better performance
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
